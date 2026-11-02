import importlib.util
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('validate', Path(__file__).parents[1] / 'scripts' / 'validate.py')
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class CatalogValidationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.project = {'id': 'demo', 'name': 'Demo', 'description': 'A project', 'category': 'Tools', 'status': 'Live', 'tags': ['Utility'], 'url': 'https://example.com/', 'source': 'https://github.com/example/demo', 'theme': 'generic', 'featured': False}

    def tearDown(self):
        self.directory.cleanup()

    def test_public_https_catalog_is_valid(self):
        module.validate_catalog([self.project], self.root)

    def test_duplicate_project_ids_fail(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            module.validate_catalog([self.project, self.project], self.root)

    def test_unsafe_urls_fail(self):
        for url in ['javascript:alert(1)', 'file:///Users/me', '//example.com', '../secret', './x/../secret', 'https://example.com\n', 'https://user:pass@example.com', './%2e%2e/secret']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                module.validate_catalog([{**self.project, 'url': url}], self.root)

    def test_local_project_must_exist(self):
        with self.assertRaisesRegex(ValueError, 'Missing'):
            module.validate_catalog([{**self.project, 'url': './projects/demo/'}], self.root)
        (self.root / 'projects' / 'demo').mkdir(parents=True)
        (self.root / 'projects' / 'demo' / 'index.html').write_text('<h1>Demo</h1>')
        module.validate_catalog([{**self.project, 'url': './projects/demo/'}], self.root)

    def test_unknown_status_and_empty_names_fail(self):
        for patch in [{'status': 'invented'}, {'name': ''}, {'tags': 'wrong'}, {'featured': 'yes'}, {'id': '../bad'}]:
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                module.validate_catalog([{**self.project, **patch}], self.root)

    def test_html_references_cannot_escape_public_directory(self):
        for reference in ['/etc/passwd', '../README.md', './%2e%2e/README.md']:
            with self.subTest(reference=reference), self.assertRaisesRegex(ValueError, 'outside'):
                module.resolve_asset(reference, self.root / 'index.html', self.root)

    def test_github_pages_prefix_resolves_inside_site(self):
        self.assertEqual(module.resolve_asset('/project-hub/favicon.svg', self.root / '404.html', self.root), (self.root / 'favicon.svg').resolve())


if __name__ == '__main__':
    unittest.main()
