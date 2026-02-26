//* Taken from collabvm-1.2.ts
//* Code location: cvmts/src/Utilities.ts | Line: 19
export function Randint(min: number, max: number) {
	return Math.floor(Math.random() * (max - min) + min);
}