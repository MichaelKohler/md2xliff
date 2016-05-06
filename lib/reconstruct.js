var xamel = require('xamel');
var tag = process.env.USE_SOURCE ? 'source' : 'target';
var fallback = process.env.MD2XLIFF_SOURCE_FALLBACK

module.exports = function(xliff, skeleton, cb) {
    xamel.parse(xliff, { buildPath: 'xliff/file/body/trans-unit', trim: false }, function(err, units) {
        if (err) return cb(err);

        units.forEach(function(unit) {
            var id = unit.attr('id');
            var text = unit.find(tag).text(true).join('');
            if (fallback && text.trim() === '') {
              text = unit.find('source').text(true).join('');
              console.log('trans-unit ' + id + ': fallback to source, content:\n', text)
            }

            skeleton = skeleton.replace('%%%' + id + '%%%', text);
        });

        cb(null, skeleton);
    });
};
