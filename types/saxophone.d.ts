declare module "saxophone" {
    import { Writable } from "stream";

    type TextNode = { contents: string };
    type CDATANode = { contents: string };
    type CommentNode = { contents: string };
    type ProcessingInstructionNode = { contents: string };
    type TagOpenNode = { name: string, attrs: string, isSelfClosing: boolean };
    type TagCloseNode = { name: string };
    type NodeEvent = "text" | "cdata" | "comment" | "processinginstruction" | "tagopen" | "tagclose";

    interface Saxophone extends Writable {
        on(event: "finish", listener: () => void): this;
        on(event: "error", listener: (err: Error) => void): this;
        on(event: "text", listener: (node: TextNode) => void): this;
        on(event: "cdata", listener: (node: CDATANode) => void): this;
        on(event: "comment", listener: (node: CommentNode) => void): this;
        on(event: "processinginstructions", listener: (node: ProcessingInstructionNode) => void): this;
        on(event: "tagopen", listener: (node: TagOpenNode) => void): this;
        on(event: "tagclose", listener: (node: TagCloseNode) => void): this;
        on(event: string | symbol | NodeEvent, listener: (...args: any[]) => void): this;
    }

    class Saxophone extends Writable {
        constructor();

        static parseAttrs(input: string): { [key: string]: string };
        static parseEntities(input: string): string;

        private _stall(token: string | null, pending: string): void;
        private _handleTagOpening(node: TagOpenNode): void;
        private _parseChunk(input: string, callback: (err?: Error) => void): void;
        _write(chunk: Buffer | string, encoding: string, callback: (error?: Error | null) => void): void;
        _final(callback: (err?: Error) => void): void;
        parse(input: Buffer | string): Saxophone;
    }

    export default Saxophone;
}
