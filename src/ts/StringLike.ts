export interface toStringable {
	toString(): string;
}
export type StringLike = string | toStringable;