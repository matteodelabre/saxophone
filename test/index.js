'use strict';

const test = require('tape');
const uniq = require('lodash.uniq');
const tags = require('common-tags');
const Saxophone = require('../');

const expectEvents = (assert, sax, events) => {
    let eventsIndex = 0;

    uniq(events.map(([name]) => name)).forEach(eventName => {
        sax.on(eventName, eventArgs => {
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

    sax.on('end', () => assert.end());
    sax.parse();
};

test('should parse comments', assert => {
    expectEvents(assert,
        Saxophone('<!-- this is a comment -->'),
        [['comment', {contents: ' this is a comment '}]]
    );
});

test('should not parse unclosed comments', assert => {
    expectEvents(assert,
        Saxophone('<!-- this is a comment ->'),
        [['error', new Error('Unclosed comment')]]
    );
});

test('should parse DOCTYPEs', assert => {
    expectEvents(assert,
        Saxophone('<!DOCTYPE html>'),
        [['doctype', {contents: ' html'}]]
    );
});

test('should not parse unclosed DOCTYPEs', assert => {
    expectEvents(assert,
        Saxophone('<!DOCTYPE html'),
        [['error', new Error('Unclosed DOCTYPE')]]
    );
});

test('should parse CDATA sections', assert => {
    expectEvents(assert,
        Saxophone('<![CDATA[this is a c&data s<>ction]]>'),
        [['cdata', {contents: 'this is a c&data s<>ction'}]]
    );
});

test('should not parse unclosed CDATA sections', assert => {
    expectEvents(assert,
        Saxophone('<![CDATA[this is a c&data s<>ction]>'),
        [['error', new Error('Unclosed CDATA section')]]
    );
});

test('should parse processing instructions', assert => {
    expectEvents(assert,
        Saxophone('<?xml version="1.0" encoding="UTF-8" ?>'),
        [['processinginstruction', {contents: 'xml version="1.0" encoding="UTF-8" '}]]
    );
});

test('should not parse unclosed processing instructions', assert => {
    expectEvents(assert,
        Saxophone('<?xml version="1.0" encoding="UTF-8">'),
        [['error', new Error('Unclosed processing instruction')]]
    );
});

test('should parse simple tags', assert => {
    expectEvents(assert,
        Saxophone('<tag>'),
        [['tagopen', {name: 'tag', attributes: '', isSelfClosing: false}]]
    );
});

test('should not parse unclosed tags', assert => {
    expectEvents(assert,
        Saxophone('<tag'),
        [['error', new Error('Unclosed tag')]]
    );
});

test('should parse self-closing tags', assert => {
    expectEvents(assert,
        Saxophone('<test />'),
        [['tagopen', {name: 'test', attributes: ' ', isSelfClosing: true}]]
    );
});

test('should parse closing tags', assert => {
    expectEvents(assert,
        Saxophone('</closed>'),
        [['tagclose', {name: 'closed'}]]
    );
});

test('should parse tags with attributes', assert => {
    expectEvents(assert,
        Saxophone('<tag attr="a" /><other attr="b"></other>'),
        [
            ['tagopen', {name: 'tag', attributes: ' attr="a" ', isSelfClosing: true}],
            ['tagopen', {name: 'other', attributes: ' attr="b"', isSelfClosing: false}],
            ['tagclose', {name: 'other'}]
        ]
    );
});

test('should parse text nodes', assert => {
    expectEvents(assert,
        Saxophone('<textarea> this\nis\na\r\n\ttextual\ncontent  </textarea>'),
        [
            ['tagopen', {name: 'textarea', attributes: '', isSelfClosing: false}],
            ['text', {contents: ' this\nis\na\r\n\ttextual\ncontent  '}],
            ['tagclose', {name: 'textarea'}]
        ]
    );
});

test('should parse a complete document', assert => {
    expectEvents(assert,
        Saxophone(tags.stripIndent`
            <?xml version="1.0" encoding="UTF-8" ?>
            <persons>
                <!-- List of persons -->
                <person name="Priscilla Z. Holden" address="320-2518 Taciti Street" />
                <person name="Raymond J. Garner" address="698-806 Dictum Road" />
                <person name="Alfonso T. Yang" address="3689 Dolor Rd." />
            </persons>
        `),
        [
            ['processinginstruction', {contents: 'xml version="1.0" encoding="UTF-8" '}],
            ['text', {contents: '\n'}],
            ['tagopen', {name: 'persons', attributes: '', isSelfClosing: false}],
            ['text', {contents: '\n    '}],
            ['comment', {contents: ' List of persons '}],
            ['text', {contents: '\n    '}],
            ['tagopen', {name: 'person', attributes: ' name="Priscilla Z. Holden" address="320-2518 Taciti Street" ', isSelfClosing: true}],
            ['text', {contents: '\n    '}],
            ['tagopen', {name: 'person', attributes: ' name="Raymond J. Garner" address="698-806 Dictum Road" ', isSelfClosing: true}],
            ['text', {contents: '\n    '}],
            ['tagopen', {name: 'person', attributes: ' name="Alfonso T. Yang" address="3689 Dolor Rd." ', isSelfClosing: true}],
            ['text', {contents: '\n'}],
            ['tagclose', {name: 'persons'}]
        ]
    );
});
