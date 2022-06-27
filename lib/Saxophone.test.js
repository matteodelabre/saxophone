const {Readable} = require('readable-stream');
const test = require('tape');
const uniq = require('lodash.uniq');
const tags = require('common-tags');

const Saxophone = require('./');

/**
 * Verify that an XML text is parsed as the specified stream of events.
 *
 * @param assert Assertion function.
 * @param xml XML string or array of XML chunks.
 * @param events Sequence of events that must be emitted in order.
 */
const expectEvents = (assert, xml, events) => {
    let eventsIndex = 0;
    const parser = new Saxophone();

    const finish = () => {
        assert.equal(eventsIndex, events.length, 'should process all events');
        assert.end();
    };

    uniq(events.map(([name]) => name)).forEach(eventName => {
        parser.on(eventName, eventArgs => {
            const [expEventName, expEventArgs] = events[eventsIndex];
            eventsIndex++;

            assert.equal(
                eventName, expEventName,
                `should trigger on${expEventName}`
            );

            if (typeof expEventArgs === 'object' && expEventArgs !== null) {
                if (expEventArgs.constructor.name === 'Error') {
                    assert.equal(
                        eventArgs.message, expEventArgs.message,
                        'should emit an error'
                    );
                    finish();
                } else {
                    assert.deepEqual(
                        eventArgs, expEventArgs,
                        'should emit with parsed data'
                    );
                }
            }
        });
    });

    parser.on('finish', finish);

    if (!Array.isArray(xml)) {
        // By default, split data in chunks of size 10
        const chunks = [];

        for (let i = 0; i < xml.length; i += 10) {
            chunks.push(xml.slice(i, i + 10));
        }

        xml = chunks;
    }

    for (let chunk of xml) {
        parser.write(chunk);
    }

    parser.end();
};

test('should parse comments', assert => {
    expectEvents(assert,
        '<!-- this is a comment -->',
        [['comment', {contents: ' this is a comment '}]]
    );
});

test('should parse comments between two chunks', assert => {
    expectEvents(assert,
        ['<', '!', '-', '-', ' this is a comment -->'],
        [['comment', {contents: ' this is a comment '}]]
    );
});

test('should parse comments ending between two chunks', assert => {
    expectEvents(assert,
        ['<!-- this is a comment --', '>'],
        [['comment', {contents: ' this is a comment '}]]
    );
});

test('should not parse unclosed comments', assert => {
    expectEvents(assert,
        '<!-- this is a comment ->',
        [['error', new Error('Unclosed comment')]]
    );
});

test('should not parse invalid comments', assert => {
    expectEvents(assert,
        '<!-- this is an -- invalid comment ->',
        [[
            'error',
            new Error("Unexpected -- inside comment: '<!-- this is an -- i'")
        ]]
    );
});

test('should parse CDATA sections', assert => {
    expectEvents(assert,
        '<![CDATA[this is a c&data s<>ction]]>',
        [['cdata', {contents: 'this is a c&data s<>ction'}]]
    );
});

test('should parse CDATA sections between two chunks', assert => {
    expectEvents(assert,
        ['<', '!', '[', 'C', 'D', 'A', 'T', 'A', '[', 'contents]]>'],
        [['cdata', {contents: 'contents'}]]
    );
});

test('should not parse invalid CDATA sections', assert => {
    expectEvents(assert,
        ['<![CDAthis is NOT a c&data s<>ction]]>'],
        [['error', new Error('Unrecognized sequence: <![')]]
    );
});

test('should not parse unclosed CDATA sections', assert => {
    expectEvents(assert,
        '<![CDATA[this is a c&data s<>ction]>',
        [['error', new Error('Unclosed CDATA section')]]
    );
});

test('should parse processing instructions', assert => {
    expectEvents(assert,
        '<?xml version="1.0" encoding="UTF-8" ?>',
        [['processinginstruction', {contents: 'xml version="1.0" encoding="UTF-8" '}]]
    );
});

test('should not parse unclosed processing instructions', assert => {
    expectEvents(assert,
        '<?xml version="1.0" encoding="UTF-8">',
        [['error', new Error('Unclosed processing instruction')]]
    );
});

test('should parse minimal document type definition', assert => {
    expectEvents(assert,
        '<!DOCTYPE DocType>',
        [['documenttypedefinition', {contents: 'DocType'}]]
    );
});

test('should parse document type definition variation 1', assert => {
    expectEvents(assert,
        '<!DOCTYPE DocType SYSTEM "file.dtd">',
        [['documenttypedefinition', {contents: 'DocType SYSTEM "file.dtd"'}]]
    );
});

test('should parse document type definition variation 2', assert => {
    expectEvents(assert,
        '<!DOCTYPE DocType SYSTEM "file.dtd">',
        [['documenttypedefinition', {contents: 'DocType SYSTEM "file.dtd"'}]]
    );
});

test('should parse document type definition variation 3', assert => {
    expectEvents(assert,
        '<!DOCTYPE DocType SYSTEM \'file.dtd\' [ any content ] >',
        [['documenttypedefinition', {contents: 'DocType SYSTEM \'file.dtd\' [ any content ] '}]]
    );
});

test('should parse document type definition variation 4', assert => {
    expectEvents(assert,
        '<!DOCTYPE DocType PUBLIC "Public Identifier" \'file.dtd\'>',
        [['documenttypedefinition', {contents: 'DocType PUBLIC "Public Identifier" \'file.dtd\''}]]
    );
});

test('should parse document type definition variation 5', assert => {
    expectEvents(assert,
        '<!DOCTYPE DocType PUBLIC \'Public Identifier\' "file.dtd" [ any content ]>',
        [['documenttypedefinition', {contents: 'DocType PUBLIC \'Public Identifier\' "file.dtd" [ any content ]'}]]
    );
});

test('should parse document type definition variation 6', assert => {
    expectEvents(assert,
        '<!DOCTYPE DocType [ any content ] >',
        [['documenttypedefinition', {contents: 'DocType [ any content ] '}]]
    );
});

test('should parse complex document type definition', assert => {
    expectEvents(assert,
        `<!DOCTYPE DocType PUBLIC   "Public Identifier"   'file.dtd' [

  <!ELEMENT DocType
  
  
  (#PCDATA)>
<!-- here is a comment space -->

<!ATTLIST    DocType    attr


CDATA #REQUIRED>

  
]

>`,
        [['documenttypedefinition', {contents: `DocType PUBLIC   "Public Identifier"   'file.dtd' [

  <!ELEMENT DocType
  
  
  (#PCDATA)>
<!-- here is a comment space -->

<!ATTLIST    DocType    attr


CDATA #REQUIRED>

  
]

`}]]
    );
});

test('should parse simple tags', assert => {
    expectEvents(assert,
        '<tag></tag>',
        [
            ['tagopen', {name: 'tag', attrs: '', isSelfClosing: false}],
            ['tagclose', {name: 'tag'}]
        ]
    );
});

test('should not parse unclosed opening tags', assert => {
    expectEvents(assert,
        '<tag',
        [['error', new Error('Unclosed tag')]]
    );
});

test('should not parse unclosed tags 2', assert => {
    expectEvents(assert,
        '<tag>',
        [['error', new Error('Unclosed tags: tag')]]
    );
});

test('should not parse unclosed tags 3', assert => {
    expectEvents(assert,
        '<closed><unclosed></closed>',
        [
            ['tagopen', {name: 'closed', attrs: '', isSelfClosing: false}],
            ['tagopen', {name: 'unclosed', attrs: '', isSelfClosing: false}],
            ['error', new Error('Unclosed tag: unclosed')],
        ]
    );
});

test('should not parse invalid tags', assert => {
    expectEvents(assert,
        '< invalid>',
        [['error', new Error('Tag names may not start with whitespace')]]
    );
});

test('should parse self-closing tags', assert => {
    expectEvents(assert,
        '<test />',
        [['tagopen', {name: 'test', attrs: ' ', isSelfClosing: true}]]
    );
});

test('should parse closing tags', assert => {
    expectEvents(assert,
        '<closed></closed>',
        [
            ['tagopen', {name: 'closed', attrs: '', isSelfClosing: false}],
            ['tagclose', {name: 'closed'}]
        ]
    );
});

test('should not parse unclosed closing tags', assert => {
    expectEvents(assert,
        '</closed',
        [['error', new Error('Unclosed tag')]]
    );
});

test('should parse tags with attributes', assert => {
    expectEvents(assert,
        '<tag first="one" second="two"  third="three " /><other attr="value"></other>',
        [
            ['tagopen', {name: 'tag', attrs: ' first="one" second="two"  third="three " ', isSelfClosing: true}],
            ['tagopen', {name: 'other', attrs: ' attr="value"', isSelfClosing: false}],
            ['tagclose', {name: 'other'}]
        ]
    );
});

test('should parse tags with attributes containing ">"', assert => {
    expectEvents(assert,
        '<tag assert="5 > 1" />',
        [
            ['tagopen', {name: 'tag', attrs: ' assert="5 > 1" ', isSelfClosing: true}],
        ]
    );
});

test('should parse text nodes', assert => {
    expectEvents(assert,
        '<textarea> this\nis\na\r\n\ttextual\ncontent  </textarea>',
        [
            ['tagopen', {name: 'textarea', attrs: '', isSelfClosing: false}],
            ['text', {contents: ' this\nis\na\r\n\ttextual\ncontent  '}],
            ['tagclose', {name: 'textarea'}]
        ]
    );
});

test('should parse text nodes outside of the root element', assert => {
    expectEvents(assert,
        'before<root>inside</root>after',
        [
            ['text', {contents: 'before'}],
            ['tagopen', {name: 'root', attrs: '', isSelfClosing: false}],
            ['text', {contents: 'inside'}],
            ['tagclose', {name: 'root'}],
            ['text', {contents: 'after'}]
        ]
    );
});

test('should parse a complete document', assert => {
    expectEvents(assert,
        tags.stripIndent`
            <?xml version="1.0" encoding="UTF-8" ?>
            <!DOCTYPE PersonType [
                <!ELEMENT persons (#PCDATA)>
                <!ELEMENT person (#PCDATA)>
            ]>
            <persons>
                <!-- List of persons -->
                <person name="Priscilla Z. Holden" address="320-2518 Taciti Street" />
                <person name="Raymond J. Garner" address="698-806 Dictum Road" />
                <person name="Alfonso T. Yang" address="3689 Dolor Rd." />
            </persons>
        `,
        [
            ['processinginstruction', {contents: 'xml version="1.0" encoding="UTF-8" '}],
            ['text', {contents: '\n'}],
            ['documenttypedefinition', {contents: `PersonType [
    <!ELEMENT persons (#PCDATA)>
    <!ELEMENT person (#PCDATA)>
]`}],
            ['text', {contents: '\n'}],
            ['tagopen', {name: 'persons', attrs: '', isSelfClosing: false}],
            ['text', {contents: '\n    '}],
            ['comment', {contents: ' List of persons '}],
            ['text', {contents: '\n    '}],
            ['tagopen', {name: 'person', attrs: ' name="Priscilla Z. Holden" address="320-2518 Taciti Street" ', isSelfClosing: true}],
            ['text', {contents: '\n    '}],
            ['tagopen', {name: 'person', attrs: ' name="Raymond J. Garner" address="698-806 Dictum Road" ', isSelfClosing: true}],
            ['text', {contents: '\n    '}],
            ['tagopen', {name: 'person', attrs: ' name="Alfonso T. Yang" address="3689 Dolor Rd." ', isSelfClosing: true}],
            ['text', {contents: '\n'}],
            ['tagclose', {name: 'persons'}]
        ]
    );
});

test('streaming and full parse should result in the same events', assert => {
    const xml = tags.stripIndent`
        <?xml version="1.0" encoding="UTF-8" ?>
        <persons>
            <!-- List of persons -->
            <person name="Priscilla Z. Holden" address="320-2518 Taciti Street" />
            <person name="Raymond J. Garner" address="698-806 Dictum Road" />
            <person name="Alfonso T. Yang" address="3689 Dolor Rd." />
        </persons>
    `;

    const parser1 = new Saxophone();
    const events1 = [];
    let finished1 = false;

    const parser2 = new Saxophone();
    const events2 = [];
    let finished2 = false;

    [
        'text',
        'cdata',
        'comment',
        'processinginstruction',
        'tagopen',
        'tagclose'
    ].forEach(eventName => {
        parser1.on(eventName, eventArgs => {
            events1.push([eventName, eventArgs]);
        });

        parser2.on(eventName, eventArgs => {
            events2.push([eventName, eventArgs]);
        });
    });

    // parser1 receives the whole data once
    parser1.parse(xml);

    // parser2 receives the data as several chunks through a piped stream
    const stream = new Readable();
    stream.pipe(parser2);

    for (let i = 0; i < xml.length; i += 9) {
        stream.push(xml.slice(i, i + 9));
    }

    stream.push(null);

    parser1.on('finish', () => {
        finished1 = true;

        if (finished2) {
            assert.deepEqual(events1, events2);
            assert.end();
        }
    });

    parser2.on('finish', () => {
        finished2 = true;

        if (finished1) {
            assert.deepEqual(events1, events2);
            assert.end();
        }
    });
});
