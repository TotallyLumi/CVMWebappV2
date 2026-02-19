import { createNanoEvents, type Emitter, type DefaultEvents, type Unsubscribe } from "nanoevents";

import * as msgpack from "msgpackr";
import * as Guacutils from "./Guacutils.js";

import type VM from "./VM.js";
import type VoteStatus from "./VoteStatus.js";
import type TurnStatus from "./TurnStatus.js";
import type { StringLike } from "../StringLike.js";
import { CollabVMProtocolMessageType, type CollabVMProtocolMessage } from "../protocol/CollabVMProtocolMessage.js";

import { User } from "./User.js";
import { AdminOpcode, Permissions, Rank } from "./Permissions.js";
import Mouse from "./Mouse.js";
import MuteState from "./MuteState.js";

const w = window as any;

export interface CollabVMClientEvents {
	close: () => void;

	message: (...args: string[]) => void;

	chat: (username: string, message: string) => void;

	//* User stuff
	adduser: (user: User) => void;
	remuser: (user: User) => void;

	renamestatus: (status: 'taken' | 'invalid' | 'blacklisted') => void;
	turn: (status: TurnStatus) => void;

	rename: (oldUsername: string, newUsername: string, selfRename: boolean) => void;

	//* Vote stuff
	vote: (status: VoteStatus) => void;
	voteend: () => void;
	votecd: (coolDownTime: number) => void;

	badpw: () => void;
	login: (rank: Rank, perms: Permissions) => void;

	//* Gonna add the auth stuff here, but this webapp will not be using them
	// auth: (server: string) => void;
	// accountlogin: (success: boolean) => void;
	// flag: () => void;
}

interface CollabVMClientPrivateEvents {
	open: () => void;

	//* VM stuff
	list: (listEntries: string[]) => void;
	connect: (connectedToVM: boolean) => void;
	ip: (username: string, ip: string) => void;
	qemu: (qemuRepsonse: string) => void;
}

const DefaultCapabilities = [ "bin" ];

export default class CVMClient {
	private socket: WebSocket;
	private unscaledCtx: CanvasRenderingContext2D;
	private ctx: CanvasRenderingContext2D;
	private url: string;
	private connectedToVM: boolean = false;
	private users: Map<string, User> = new Map();
	private username: string | null = null;
	private mouse: Mouse = new Mouse();
	private rank: Rank = Rank.Unregistered;
	private perms: Permissions = new Permissions(0);
	private voteStatus: VoteStatus | null = null;
	private node: string | null = null;
	// private auth: boolean = false;

	private internalEmitter: Emitter<CollabVMClientPrivateEvents>;
	private publicEmitter: Emitter<CollabVMClientEvents>;

	private unsubscribeCallbacks: Array<Unsubscribe> = [];

	canvas: HTMLCanvasElement;
	unscaledCanvas: HTMLCanvasElement;
	canvasScale: {
		width: number,
		height: number,
	} = {
		width: 0,
		height: 0,
	};
	actualScreenSize: {
		width: number,
		height: number,
	} = {
		width: 0,
		height: 0,
	};

	constructor(url: string) {
		this.url = url;

		this.internalEmitter = createNanoEvents();
		this.publicEmitter = createNanoEvents();

		this.canvas = document.createElement("canvas");
		this.canvas.tabIndex = -1;
		this.unscaledCanvas = document.createElement("canvas");

		this.ctx = this.canvas.getContext("2d")!;
		this.unscaledCtx = this.canvas.getContext("2d")!;

		//* Canvas stuff

		//* Websocket stuff
		this.socket = new WebSocket(url, "guacamole");
		this.socket.binaryType = "arraybuffer";

		this.socket.addEventListener("open", () => this.onOpen());
		this.socket.addEventListener("message", () => this.onMessage(event));
		this.socket.addEventListener("close", () => this.publicEmitter.emit("close"));
	}

	private onOpen() {
		this.internalEmitter.emit("open");
	}

	private onBinaryMessage(data: ArrayBuffer) {
		let msg: CollabVMProtocolMessage;

		try {
			msg = msgpack.decode(data);
		} catch {
			console.error("Server sent an invalid binary message");
			return;
		}

		if (msg.type === undefined) return;

		switch(msg.type) {
			case CollabVMProtocolMessageType.rect: {
				if (!msg.rect?.data || msg.rect.x === undefined || msg.rect.y === undefined) return;

				const buffer = msg.rect.data.buffer.slice(msg.rect.data.byteOffset, msg.rect.data.byteOffset + msg.rect.data.byteLength) as ArrayBuffer;

				const blob = new Blob([buffer], { type: "image/jpeg" });

				createImageBitmap(blob).then((bitmap) => {
					this.ctx.drawImage(bitmap, 0, 0);
				});
				break;
			}
		}
	}

	private onMessage(event: MessageEvent) {
		if (event.data instanceof ArrayBuffer) {
			this.onBinaryMessage(event.data);
			return;
		}

		let msgArr: string[];

		try {
			msgArr = Guacutils.decode(event.data);
		} catch (e) {
			console.error(`Server sent an invalid message (${e})`);
			return;
		}

		this.publicEmitter.emit('message', ...msgArr);

		switch (msgArr[0]) {
			case 'nop': {
				this.send('nop');
				break;
			}
			case 'list': {
				this.internalEmitter.emit('list', msgArr.slice(1));
				break;
			}
			case 'connect': {
				this.connectedToVM = msgArr[1] === '1';
				this.internalEmitter.emit('connect', this.connectedToVM);
				break;
			}
			case 'size': {
				if (msgArr[1] !== '0') return;

				const width = Number(msgArr[2]);
				const height = Number(msgArr[3]);

				this.recalculateCanvasScale(width, height);

				const { actualScreenSize, canvasScale, unscaledCanvas, canvas } = this;

				unscaledCanvas.width = actualScreenSize.width;
				unscaledCanvas.height = actualScreenSize.height;

				canvas.width = canvasScale.width;
				canvas.height = canvasScale.height;
				break;
			}
			case 'png': {
				//! This case is a mess, just to add performance points to the webapp.
				const msgArr = event.data.split(',');
				const x = Number(msgArr[3]);
				const y = Number(msgArr[4]);

				if (Number.isNaN(x) || Number.isNaN(y)) return;
				if (typeof event.data !== 'string') return;

				const base64 = msgArr[5];
				if (!base64) return;

				const byteCharacters = atob(base64);
				const byteNumbers = new Uint8Array(byteCharacters.length);

				for (let i = 0; i< byteCharacters.length; i++) {
					byteNumbers[i] = byteCharacters.charCodeAt(i);
				}

				const blob = new Blob([byteNumbers], { type: 'image/jpeg' });

				createImageBitmap(blob).then(bitmap => {
					this.loadRectangle(bitmap, x, y);
				});
				break;
			}
			case 'chat': {
				for (let i = 1; i < msgArr.length; i += 2) {
					this.publicEmitter.emit('chat', msgArr[i]!, msgArr[i + 1]!);
				}
				break;
			}
			case 'adduser': {
				for (let i = 2; i + 1 < msgArr.length; i += 2) {
					const username = msgArr[i];
					const rankString = msgArr[i + 1];

					if (!username || !rankString) continue;

					const rank = Number(rankString);

					let user = this.users.get(username);

					if (user) {
						user.rank = rank;
					} else {
						user = new User(username, rank);
						this.users.set(username, user);
					}
					this.publicEmitter.emit('adduser', user);
				}
			}
			case 'remuser': {
				for (let i = 2; i < msgArr.length; i++) {
					const username = msgArr[i];
					if (!username) continue;

					const user = this.users.get(username);
					if (!user) continue;

					this.users.delete(username);
					this.publicEmitter.emit('remuser', user);
				}
			}
			case 'rename': {
				const mode = msgArr[1];
				const status = msgArr[2];
				const newUsername = msgArr[3];

				if (!newUsername) return;

				let selfRename = false;
				let oldUsername: string | undefined;

				if (mode === '0') {
					selfRename = true;
					oldUsername = this.username ?? undefined;

					switch (status) {
						case '1':
							this.publicEmitter.emit('renamestatus', 'taken');
							break;
						case '2':
							this.publicEmitter.emit('renamestatus', 'invalid');
							break;
						case '3':
							this.publicEmitter.emit('renamestatus', 'blacklisted');
							break;
					}
					this.username = newUsername;
				} else {
					oldUsername = status;
				}

				if (!oldUsername) return;

				const user = this.users.get(oldUsername);

				if (user) {
					this.users.delete(oldUsername);
					user.username = newUsername;
					this.users.set(newUsername, user);
				}

				this.publicEmitter.emit('rename', oldUsername, newUsername, selfRename);
			}
			case 'turn': {
				for (const user of this.users.values()) {
					user.turn = -1;
				}

				const queuedUsers = Number(msgArr[2]);
				const currentUsername = msgArr[3];

				if (!queuedUsers || !currentUsername) {
					this.publicEmitter.emit('turn', {
						user: null,
						queue: [],
						turnTime: null,
						queueTime: null
					});
					return;
				}

				const currentTurn = this.users.get(currentUsername);
				if (!currentTurn) return;

				currentTurn.turn = 0;

				const queue: User[] = [];

				for (let i = 1; i < queuedUsers; i++) {
					const username = msgArr[i + 3];
					if (!username) continue;

					const user = this.users.get(username);
					if (!user) continue;

					user.turn = i;
					queue.push(user);
				}

				const turnTime =
				currentTurn.username === this.username
					? Number(msgArr[1])
					: null;

				const queueTime =
					queue.some(u => u.username === this.username)
						? Number(msgArr[msgArr.length - 1])
						: null;

				this.publicEmitter.emit('turn', {
					user: currentTurn,
					queue,
					turnTime,
					queueTime
				});
			}
			case 'vote': {
				switch (msgArr[1]) {
					case '0':
						//! Vote started
					case '1':
						let timeToEnd = Number(msgArr[2]);
						let yesVotes = Number(msgArr[3]);
						let noVotes = Number(msgArr[4]);

						if (Number.isNaN(timeToEnd) || Number.isNaN(yesVotes) || Number.isNaN(noVotes)) return;

						this.voteStatus = {
							timeToEnd: timeToEnd,
							yesVotes: yesVotes,
							noVotes: noVotes
						};

						this.publicEmitter.emit('vote', this.voteStatus);
						break;
					case '2':
						this.voteStatus = null;

						this.publicEmitter.emit('voteend');
						break;
					case '3':
						this.publicEmitter.emit('votecd', Number(msgArr[3]));
				}
				break;
			}
			// case 'auth': {

			// }
			// case 'login': {

			// }
			case 'admin': {
				switch (msgArr[1]) {
					case '0': {
						switch (msgArr[2]) {
							case '0':
								this.publicEmitter.emit('badpw');
								return;
							case '1':
								this.perms.set(65535);
								this.rank = Rank.Admin;
								break;
							case '3':
								this.perms.set(Number(msgArr[3]));
								this.rank = Rank.Moderator;
								break;
						}
						this.publicEmitter.emit('login', this.rank, this.perms);
						break;
					}
					case '19': {
						this.internalEmitter.emit('ip', msgArr[2]!, msgArr[3]!);
						break;
					}
					case '2': {
						this.internalEmitter.emit('qemu', msgArr[2]!);
						break;
					}
				}
				break;
			}
			// case 'flag': {
			// 	for (let i = 1; i + 1 < msgArr.length; i += 2) {
			// 		const username = msgArr[i];
			// 		const countryCode = msgArr[i + 1];

			// 		if (!username || !countryCode) continue;

			// 		const user = this.users.get(username);

			// 		if (user) {
			// 			user.countryCode = countryCode;
			// 		}
			// 	}

			// 	this.publicEmitter.emit('flag');
			// }
		}
	}

	private loadRectangle(img: HTMLImageElement, x: number, y: number) {
		if (this.actualScreenSize.width !== this.canvasScale.width || this.actualScreenSize.height !== this.canvasScale.height)
			this.unscaledCtx.drawImage(img, x, y);

		this.ctx.drawImage(img, 0, 0, img.width, img.height,
			(x / this.actualScreenSize.width) * this.canvas.width,
			(y / this.actualScreenSize.height) * this.canvas.height,
			(img.width / this.actualScreenSize.width) * this.canvas.width,
			(img.height / this.actualScreenSize.height) * this.canvas.height
		);
	}

	private onWindowResize(e: Event) {
		if (!this.connectedToVM) return;
		if (window.innerWidth >= this.actualScreenSize.width && this.canvas.width === this.actualScreenSize.width) return;
		if (this.actualScreenSize.width === this.canvasScale.width && this.actualScreenSize.height === this.canvasScale.height) {
			this.unscaledCtx.drawImage(this.canvas, 0, 0);
		}

		this.recalculateCanvasScale(this.actualScreenSize.width, this.actualScreenSize.height);

		this.canvas.width = this.canvasScale.width;
		this.canvas.height = this.canvasScale.height;

		this.ctx.drawImage(this.unscaledCanvas, 0, 0, this.actualScreenSize.width, this.actualScreenSize.height, 0, 0, this.canvas.width, this.canvas.height);
	}

	private recalculateCanvasScale(width: number, height: number) {
		this.actualScreenSize.width = width;
		this.actualScreenSize.height = height;

		if (window.innerWidth >= this.actualScreenSize.width) {
			this.canvasScale.width = this.actualScreenSize.width;
			this.canvasScale.height = this.actualScreenSize.height;
		} else {
			this.canvasScale.width = window.innerWidth;
			this.canvasScale.height = (window.innerWidth / this.actualScreenSize.width) * this.actualScreenSize.height;
		}
	}

	async WaitForOpen() {
		return new Promise<void>((res) => {
			let unsub = this.onInternal('open', () => {
				unsub();
				res();
			});
		});
	}

	send(...args: StringLike[]) {
		let guacElements = [...args].map((el) => {
			if (typeof el == 'string') return el as string;

			return el.toString();
		});
		this.socket.send(Guacutils.encode(...guacElements));
	}

	list(): Promise<VM[]> {
		return new Promise((res, rej) => {
			let u = this.onInternal('list', (list: string[]) => {
				u();

				let vms: VM[] = [];

				for (let i = 0; i < list.length; i += 3) {
					let th = new Image();
					th.src = 'data:image/jpeg;base64', + list[i + 2];
					vms.push({
						url: this.url,
						id: list[i],
						displayName: list[i + 1],
						thumbnail: th
					});
				}
				res(vms);
			});
			this.send('list');
		});
	}

	connect(id: string, username: string | null = null): Promise<boolean> {
		return new Promise((res) => {
			let u = this.onInternal('connect', (success: boolean) => {
				u();
				res(success);
			});

			if (localStorage.getItem('cvm-hide-flag') === 'true') this.send('noFlag');
			if (username === null) this.send('rename');
			else this.send('rename', username);

			if (DefaultCapabilities.length > 0) this.send('cap', ...DefaultCapabilities);

			this.send('connect', id);
			this.node = id;
		});
	}

	close() {
		this.connectedToVM = false;

		for (let cb of this.unsubscribeCallbacks) {
			cb();
		}
		this.unsubscribeCallbacks = [];

		if (this.socket.readyState === WebSocket.OPEN) this.socket.close();
	}

	getUsers(): User[] {
		return [...this.users.values()];
	}

	private onInternal<E extends keyof CollabVMClientPrivateEvents>(event: E, callback: CollabVMClientPrivateEvents[E]): Unsubscribe {
		return this.internalEmitter.on(event, callback);
	}
}