import { Rank } from './Permissions.js';

export class User {
	username: string;
	rank: Rank;
	turn: number;
	countryCode: string | null = null;

	constructor(username: string, rank: Rank = Rank.Unregistered) {
		this.username = username;
		this.rank = rank;
		this.turn = -1;
	}
}