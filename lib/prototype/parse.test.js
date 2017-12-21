const test = require('tape');
const uniq = require('lodash.uniq');
const tags = require('common-tags');
const Saxophone = require('../');

const expectEvents = (assert, xml, events) => {
    let eventsIndex = 0;
    const parser = new Saxophone();

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
                } else {
                    assert.deepEqual(
                        eventArgs, expEventArgs,
                        'should emit with parsed data'
                    );
                }
            }
        });
    });

    parser.on('end', () => {
        assert.equal(eventsIndex, events.length, 'should process all events');
        assert.end();
    });
    for (let i = 0; i < xml.length; i += 9) {
        parser.write(xml.slice(i, i + 9));
    }
    parser.end();
};

test('should parse comments', assert => {
    expectEvents(assert,
        '<!-- this is a comment -->',
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
        [['error', new Error('Unexpected -- inside comment')]]
    );
});

test('should parse CDATA sections', assert => {
    expectEvents(assert,
        '<![CDATA[this is a c&data s<>ction]]>',
        [['cdata', {contents: 'this is a c&data s<>ction'}]]
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

test('should parse simple tags', assert => {
    expectEvents(assert,
        '<tag></tag>',
        [
            ['tagopen', {name: 'tag', attrs: '', isSelfClosing: false}],
            ['tagclose', {name: 'tag'}]
        ]
    );
});

test('should not parse unclosed tags 1', assert => {
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

test('should not parse DOCTYPEs', assert => {
    expectEvents(assert,
        '<!DOCTYPE html>',
        [['error', new Error('Unrecognized sequence: <!D')]]
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

test('should parse tags containing attributes', assert => {
    expectEvents(assert,
        '<tag first="one" second="two"  third="three " /><other attr="value"></other>',
        [
            ['tagopen', {name: 'tag', attrs: ' first="one" second="two"  third="three " ', isSelfClosing: true}],
            ['tagopen', {name: 'other', attrs: ' attr="value"', isSelfClosing: false}],
            ['tagclose', {name: 'other'}]
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
    const parser2 = new Saxophone();

    const events1 = [];
    const events2 = [];
    ['processinginstruction', 'text', 'tagopen', 'comment', 'tagclose'].forEach(eventName => {
        parser1.on(eventName, eventArgs => { 
            events1.push([eventName, eventArgs]);
        });
        parser2.on(eventName, eventArgs => { 
            events2.push([eventName, eventArgs]);
        });
    });

    parser1.parse(xml);

    for (let i = 0; i < xml.length; i += 9) {
        parser2.write(xml.slice(i, i + 9));
    }
    parser2.end();

    assert.deepEqual(events1, events2);
    assert.end();
});
