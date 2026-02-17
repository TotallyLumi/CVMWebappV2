import type { CollabVMRectMessage } from "./CollabVMRectMessage.js";

export interface CollabVMProtocolMessage {
	type: CollabVMProtocolMessageType,
	rect?: CollabVMRectMessage | undefined;
}

export enum CollabVMProtocolMessageType {
	rect = 0,
}