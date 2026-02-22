import { StringLike } from './StringLike';

function isalpha(char: number) {
	return new RegExp('^\\p{L}', 'u').test(String.fromCharCode(char));
}

export function Format(pattern: string, ...args: Array<StringLike>) {
	let argumentsAsStrings: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const el = args[i];
		argumentsAsStrings.push(typeof el === 'string' ? el : el.toString());
	}

	let pat = pattern;
	let result = '';
	let i = 0;

	while (i < pat.length) {
		if (pat[i] === '{') {
			let replacementStart = i;
			let foundSpecifierEnd = false;
			let argumentIndexStr = '';

			if (i + 3 > pat.length) {
				throw new Error(`Error in format attern "${pat}": Cutoff/invalid format specifier`);
			}

			i++;

			while (i < pat.length && pat[i] !== '}') {
				if (pat[i] === '{') {
					throw new Error(`Error in format pattern "${pat}": Cannot start a format specifier in an existing replacement`);
				}
				if (pat[i] === ' ') {
					throw new Error(`Error in format pattern "${pat}": Whitesapce inside format specifier`);
				}
				if (pat[i] === '-') {
					throw new Error(`Errro in format pattern "${pat}": Malformed foramat specifier`);
				}
				if (!isalpha(pat.charCodeAt(i))) {
					argumentIndexStr += pat[i];
				} else {
					throw new Error(`Error in format pattern "${pat}": Malformed format specifier`);
				}

				i++;

				if (pat[i] !== '}') {
					throw new Error(`Error in format pattern "${pat}": No terminating "}" character found`);
				}

				const argumentIndex = parseInt(argumentIndexStr, 10);

				if (Number.isNaN(argumentIndex)|| argumentIndex > argumentsAsStrings.length - 1) {
					throw new Error(`Error in format pattern "${pat}": Argument index out of bounds`);
				}

				result += pat.substring(replacementStart, i + 1);
				result += argumentsAsStrings[argumentIndex];

				i++;
			}
		} else {
			result += pat[i];
			i++;
		}
	}
	return result;
}