# md2xliff

This fork has some changes in order to support XLIFF placeholder for:

- markdown wrapped into `<span>` and `<div>` tags
- markdown with a [Front Matter](https://jekyllrb.com/docs/frontmatter) header
- markdown which contains [Handlebars](https://github.com/wycats/handlebars.js) partials and helper
- markdown which contains [FreeMarker](https://github.com/apache/incubator-freemarker) syntax

##### new environment variable:

`MD2XLIFF_SOURCE_FALLBACK`

Set this env variable to 1 to use the `<source>` content if the `<target>` contains
an empty content.

---

Markdown to [XLIFF](http://www.oasis-open.org/committees/xliff/documents/xliff-specification.htm) and XLIFF to markdown converter.

Idea behind it is described at [XML in Localisation: Use XLIFF to Translate Documents](http://www.maxprograms.com/articles/xliff.html) article.

Package provides `extract` module which parses markdown files and generates XLIFF and skeleton.

Translater fills XLIFF with translations. `pretranslate` module may be used for automatic translation with the help of Yandex [Translator API](https://tech.yandex.com/translate/).

[Online XLIFF Editor](http://xliff.brightec.co.uk/) may be used to work with XLIFF files.

Then with `reconstruct` module it is possible to build translated markdown with the same markup as in source document.

## Usage
All modules have JS API and a CLI.

### extract
To extract XLIFF and generate skeleton run `./bin/extract test/source.md`.

### reconstruct
To reconstruct new markdown from XLIFF and skeleton built with `extract` command run
`./bin/reconstruct test/source.xlf test/source.skl.md target.md`.

Environment variable `USE_SOURCE` may also be used to reconstruct target markdown from `<source>` units of XLIFF. It is helpful for testing:
`USE_SOURCE=1 ./bin/reconstruct test/source.xlf test/source.skl.md target.md`.

### pretranslate
To automatically pretranslate XLIFF run `API_KEY=your-yandex-translator-api-key ./bin/pretranslate test/source.xlf`.

It is also possible to set `JUST_UPPER_CASE` environment variable to use upper case of `source` units instead of translation which may be useful for testing: `JUST_UPPER_CASE=1 ./bin/pretranslate test/source.xlf`.
