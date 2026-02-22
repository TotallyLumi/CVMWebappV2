import { StringLike } from './StringLike';
import { Format } from './format';
import { Emitter, Unsubscribe, createNanoEvents } from 'nanoevents';
import Config from '../../config.json';

export enum I18nStringKey {
	//! These are the basic string keys at the moment for the webapp but I will be adding the rest in, when I have the chance.

	// Generic thingys
	kGeneric_CollabVM = 'kGeneric_CollabVM',
	kGeneric_Yes = 'kGeneric_Yes',
	kGeneric_No = 'kGeneric_No',
	kGeneric_Ok = 'kGeneric_Ok',
	kGeneric_Cancel = 'kGeneric_Cancel',
	kGeneric_Send = 'kGeneric_Send',
	kGeneric_Understood = 'kGeneric_Understood',

	// Site thingys
	kSiteButtons_Home = 'kSiteButtons_Home',
	kSiteButtons_Languages = 'kSiteButtons_Languages',

	// VM thingys
	kVM_UsersOnlineText = 'kVM_UsersOnlineText',
	kVM_TurnTimeTimer = 'kVM_TurnTimeTimer',
	kVM_WaitingTurnTimer = 'kVM_WaitingTurnTimer',
	kVM_VoteCooldownTimer = 'kVM_VoteCooldownTimer',
	kVM_VoteForResetTitle = 'kVM_VoteForResetTitle',
	kVM_VoteForResetTimer = 'kVM_VoteForResetTimer',

	kVMButtons_TakeTurn = 'kVMButtons_TakeTurn',
	kVMButtons_EndTurn = 'kVMButtons_EndTurn',
	kVMButtons_ChangeUsername = 'kVMButtons_ChangeUsername',
	kVMButtons_Keyboard = 'kVMButtons_Keyboard',
	kVMButtons_CtrlAltDel = 'KVMButtons_CtrlAltDel',
	kVMButtons_VoteForReset = 'kVMButtons_VoteForReset',
	kVMButtons_Screenshot = 'kVMButtons_Screenshot',

	// error messages
	kError_UnexpectedDisconnection = 'kError_UnexpectedDisconnection',
	kError_UsernameTaken = 'kError_UsernameTaken',
	kError_UsernameInvalid = 'kError_UsernameInvalid',
	kError_UsernameBlacklisted = 'kError_UsernameBlacklisted',
	kError_IncorrectPassword = 'kError_IncorrectPassword',
}

export interface I18nEvents {
	languageChanged: (lang: string) => void;
}

export type Language = {
	languageName: string;
	translatedLanguageName:  string;
	flag: string;
	author: string;

	stringKeys: {
		[key: string]: string;
	};
};

export type LanguageMetadata = {
	languageName: string;
	flag: string;
};

export type LanguageJson = {
	languages: { [key: string]: LanguageMetadata };
	defaultLanguage: string;
};

const fallbackId = '!!fallback';
import fallbackLanguage from './fallbacklanguage.js';

interface StringKeyMap {
	[k: string]: I18nStringKey;
}

export class I18n {
	private langs: Map<string, LanguageMetadata> = new Map<string, Language>();
	private lang: Language = fallbackLanguage;
	private languageDropdown: HTMLSpanElement = document.getElementById('languageDropdown') as HTMLSpanElement;
	private emitter: Emitter<I18nEvents> = createNanoEvents();

	CurrentLanguage = () => this.langId;

	private langId: string = fallbackId;
	private regionNameRenderer = new Intl.DisplayNames( ['en-US'], { type: 'region' } );

	async Init() {
		try {
			const res = await fetch('lang/languages.json');

			if (!res.ok) {
				throw new Error(`Failed to load languages.json: ${res.statusText}`);
			}

			const langData = await res.json() as LanguageJson;

			for (const langId in langData.languages) {
				this.langs.set(langId, langData.languages[langId]);
			}

			const links: HTMLAnchorElement[] = [];

			this.langs.forEach((_lang, langId) => {
				const a = document.createElement('a');

				a.classList.add('dropdown-item');
				a.href = '#';
				a.innerText = `${_lang.flag} ${_lang.languageName}`;
				a.addEventListener('click', async (e) => {
					e.preventDefault();

					await this.setLanguage(langId);
					this.replaceStaticStrings();
				});
				links.push(a);
			});


			this.languageDropdown.append(...links);

			let lang = null;

			const isLang = window.localStorage.getItem('i18n-lang');
			const browserLang = navigator.language.toLowerCase();

			if (isLang !== null && this.langs.has(isLang)) {
				lang = isLang;
			} else if (this.langs.has(browserLang)) {
				lang = browserLang;
			} else {
				for (let langId in langData.languages) {
					if (langId.split('-')[0] === browserLang.split('-')[0]) {
						lang = langId;
						break;
					}
				}
			}

			if (lang === null) {
				lang = langData.defaultLanguage;
			}

			await this.setLanguage(lang);
			this.replaceStaticStrings();
		} catch (error) {
			console.error('BROKEN');

			await this.setLanguage(fallbackId);
			this.replaceStaticStrings();
		}
	}

	getCountryName(code: string): string {
		return this.regionNameRenderer.of(code) || code;
	}

	private async setLanguage(id: string) {
		let lastId = this.langId;

		this.langId = id;

		let lang;

		if (id === fallbackId)
			lang = fallbackLanguage;
		else {
			let path = `./lang/${id}.json`;
			let res = await fetch(path);

			if (!res.ok) {
				console.error(`Failed to load lang/${id}.json: ${res.statusText}`);

				await this.setLanguage(fallbackId);
				return;
			}
			lang = await res.json() as Language;
		}

		this.lang = lang;

		if (this.langId != lastId) {
			this.replaceStaticStrings();

			this.regionNameRenderer = new Intl.DisplayNames( [this.langId], { type: 'region'} );
		};

		if (this.langId !== fallbackId) {
			window.localStorage.setItem('i18n-lang', this.langId);
		}

		this.emitter.emit('languageChanged', this.langId);
		console.log('i18n initalized for', id, 'successfully');
	}

	private replaceStaticStrings() {
		const kDomIdtoStringMap: StringKeyMap = {
			siteNameText: I18nStringKey.kGeneric_CollabVM,
			homeBtnText: I18nStringKey.kSiteButtons_Home,
			languageDropdownText: I18nStringKey.kSiteButtons_Languages,

			// welcomeModalDismiss: I18nStringKey.kGeneric_Understood,

			usersOnlineText: I18nStringKey.kVM_UsersOnlineText,

			voteResetHeaderText: I18nStringKey.kVM_VoteForResetTitle,
			voteYesBtnText: I18nStringKey.kGeneric_Yes,
			voteNoBtnText: I18nStringKey.kGeneric_No,

			changeUsernameBtnText: I18nStringKey.kVMButtons_ChangeUsername,
			oskBtnText: I18nStringKey.kVMButtons_Keyboard,
			ctrlAltDelBtnText: I18nStringKey.kVMButtons_CtrlAltDel,
			voteForResetBtnText: I18nStringKey.kVMButtons_VoteForReset,
			screenshotBtnText: I18nStringKey.kVMButtons_Screenshot,

			// admin stuff
			// badPasswordAlertText: I18nStringKey.kError_IncorrectPassword,
			// loginModalPasswordText: I18nStringKey.kGeneric_Password,
			// loginButton: I18nStringKey.kGeneric_Login,
			// passVoteBtnText: I18nStringKey.kAdminVMButtons_PassVote,
			// cancelVoteBtnText: I18nStringKey.kAdminVMButtons_CancelVote,
			endTurnBtnText: I18nStringKey.kVMButtons_EndTurn,
			// qemuMonitorBtnText: I18nStringKey.kQEMUMonitor,
			// qemuModalHeader: I18nStringKey.kQEMUMonitor,
			qemuMonitorSendBtn: I18nStringKey.kGeneric_Send,

			// restoreBtnText: I18nStringKey.kAdminVMButtons_Restore,
			// rebootBtnText: I18nStringKey.kAdminVMButtons_Reboot,
			// clearQueueBtnText: I18nStringKey.kAdminVMButtons_ClearTurnQueue,
			// bypassTurnBtnText: I18nStringKey.kAdminVMButtons_BypassTurn,
			// indefTurnBtnText: I18nStringKey.kAdminVMButtons_IndefiniteTurn,
			// ghostTurnBtnText: I18nStringKey.kAdminVMButtons_GhostTurnOff,
		};

		const kDomAttributeToStringMap = {
			// adminPassword: {
			// 	placeholder: I18nStringKey.kGeneric_Password,
			// }
		};

		const kDomClassToStringMap: StringKeyMap = {
			"mod-end-turn-btn": I18nStringKey.kVMButtons_EndTurn,
			// "mod-ban-btn": I18nStringKey.kAdminVMButtons_Ban,
			// "mod-kick-btn": I18nStringKey.kAdminVMButtons_Kick,
			"mod-change-username-btn": I18nStringKey.kVMButtons_ChangeUsername,
			// "mod-temp-mute-btn": I18nStringKey.kAdminVMButtons_TempMute,
			// "mod-indef-mute-btn": I18nStringKey.kAdminVMButtons_IndefMute,
			// "mod-unmute-btn": I18nStringKey.kAdminVMButtons_Unmute,
			// "mod-get-ip-btn": I18nStringKey.kAdminVMButtons_GetIP,
		}

		for (let domId of Object.keys(kDomIdtoStringMap)) {
			let element = document.getElementById(domId);
			if (element == null) {
				alert(`Error: Could not find element with ID ${domId} in the DOM! Please tell a site admin this happened.`);
				return;
			}

			element.innerHTML = this.getStringRaw(kDomIdtoStringMap[domId]);
		}

		for (let domId of Object.keys(kDomAttributeToStringMap)) {
			let element = document.getElementById(domId);
			if (element == null) {
				alert(`Error: Could not find element with ID ${domId} in the DOM! Please tell a site admin this happened.`);
				return;
			}

			// @ts-ignore
			let attributes = kDomAttributeToStringMap[domId];
			for (let attr of Object.keys(attributes)) {
				element.setAttribute(attr, this.getStringRaw(attributes[attr] as I18nStringKey));
			}
		}

		for (let domClass of Object.keys(kDomClassToStringMap)) {
			let elements = document.getElementsByClassName(domClass);
			for (let element of elements) {
				element.innerHTML = this.getStringRaw(kDomClassToStringMap[domClass]);
			}
		}
	}

		getStringRaw(key: I18nStringKey): string {
		if (key === I18nStringKey.kGeneric_CollabVM && Config.SiteNameOverride) return Config.SiteNameOverride;

		let val = this.lang.stringKeys[key];

		if (val == undefined) {
			let fallback = fallbackLanguage.stringKeys[key];
			if (fallback !== undefined)
				val = fallback;
			else return `${key} (ERROR LOOKING UP TRANSLATION!!!)`;
		}

		return val;
	}

	getString(key: I18nStringKey, ...replacements: StringLike[]): string {
		return Format(this.getStringRaw(key), ...replacements);
	}

	on<e extends keyof I18nEvents>(event: e, cb: I18nEvents[e]): Unsubscribe {
		return this.emitter.on(event, cb);
	}
}

export let TheI18n = new I18n();