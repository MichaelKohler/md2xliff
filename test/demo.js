process.env.USE_SOURCE = true;
fs = require('fs');

var fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    md2xliff = require('..'),
    sourceMdFile = path.resolve(__dirname, 'demo.md'),
    sourceMd = fs.readFileSync(sourceMdFile, 'utf8'),
    extracted = md2xliff.extract(sourceMd, sourceMdFile);

    fs.writeFileSync('tmp.xlf', extracted.xliff);
    fs.writeFileSync('tmp.skl', extracted.skeleton);

    reconstructed = md2xliff.reconstruct(extracted.xliff, extracted.skeleton, function(err, translatedMd) {
        if (err) throw new Error(err);

        try {
            assert.equal(sourceMd, translatedMd);
        } catch(err) {
            console.log('Expected:', sourceMd);
            console.log('Actual result:', translatedMd);
            throw new Error(err);
        }

    });
