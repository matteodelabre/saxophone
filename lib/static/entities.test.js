const test = require('tape');
const Saxophone = require('../');

test('should normalize character entity references', assert => {
    assert.equal(Saxophone.parseEntities('&quot;Run!&quot;, he said'), '"Run!", he said', 'normalize &quot;');
    assert.equal(Saxophone.parseEntities('&amp; On &amp; On &amp; On'), '& On & On & On', 'normalize &amp;');
    assert.equal(Saxophone.parseEntities('J&apos;irai demain'), "J'irai demain", 'normalize &apos;');
    assert.equal(Saxophone.parseEntities('&lt;thisIsNotATag&gt;'), '<thisIsNotATag>', 'normalize &gt; and &lt;');
    assert.equal(Saxophone.parseEntities('&lt;&gt;&quot;&amp;&amp;&quot;&apos;&gt;'), '<>"&&"\'>', 'normalize several');
    assert.end();
});

test('should normalize numeric character references', assert => {
    assert.equal(Saxophone.parseEntities('&#xA7;'), '§', 'normalize hexadecimal entities');
    assert.equal(Saxophone.parseEntities('&#167;'), '§', 'normalize decimal entities');
    assert.equal(Saxophone.parseEntities('&#8258;&#x2612;&#12291;&#x2E3B;'), '⁂☒〃⸻', 'normalize mixed entities');
    assert.end();
});

test('should ignore invalid character entity references', assert => {
    assert.equal(Saxophone.parseEntities('&unknown;'), '&unknown;', 'ignore unknown entity references');
    assert.equal(Saxophone.parseEntities('&amp'), '&amp', 'ignore unterminated entity references');
    assert.equal(Saxophone.parseEntities('&#notanumber;'), '&#notanumber;', 'ignore non-numeric decimal character refrences');
    assert.equal(Saxophone.parseEntities('&#xnotanumber;'), '&#xnotanumber;', 'ignore non-numeric hexa character refrences');
    assert.end();
});
