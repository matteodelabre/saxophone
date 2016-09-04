const test = require('tape');
const Saxophone = require('../');

test('should parse tag attributes', assert => {
    assert.deepEqual(
        Saxophone.parseAttrs(' first="one" second="two"  third="three " '),
        {
            first: 'one',
            second: 'two',
            third: 'three '
        }
    );

    assert.end();
});

test('should not parse attributes without a value', assert => {
    assert.throws(() => {
        Saxophone.parseAttrs(' first');
    }, /Expected a value for the attribute/);
    assert.end();
});

test('should not parse invalid attribute names', assert => {
    assert.throws(() => {
        Saxophone.parseAttrs(' this is an attribute="value"');
    }, /Attribute names may not contain whitespace/);
    assert.end();
});

test('should not parse unquoted attribute values', assert => {
    assert.throws(() => {
        Saxophone.parseAttrs(' attribute=value value=invalid');
    }, /Attribute values should be quoted/);
    assert.end();
});

test('should not parse misquoted attribute values', assert => {
    assert.throws(() => {
        Saxophone.parseAttrs(' attribute="value\'');
    }, /Unclosed attribute value/);
    assert.end();
});
