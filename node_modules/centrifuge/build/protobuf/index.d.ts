import { Centrifuge } from '../centrifuge';
export declare class ProtobufEncoder {
    encodeEmulationRequest(req: any): any;
    encodeCommands(commands: any[]): any;
}
export declare class ProtobufDecoder {
    decodeReplies(data: any): any[];
    decodeReply(data: any): {
        ok: boolean;
        pos: any;
    } | {
        ok: boolean;
        pos?: undefined;
    };
}
export default class CentrifugeProtobuf extends Centrifuge {
    protected _formatOverride(format: 'json' | 'protobuf'): boolean;
}
