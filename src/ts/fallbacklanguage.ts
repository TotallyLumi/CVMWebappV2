import { Language } from "./i18n.js";

const fallbackLanguage: Language = {
	"languageName": "English (US)",
	"translatedLanguageName": "English (US)",
	"flag": "🇺🇸",
	"author": "TotallyLumi",

	"stringKeys": {
		// Generic thingys
		"kGeneric_CollabVM": 'CollabVM',
		"kGeneric_Yes": 'Yes',
		"kGeneric_No": 'No',
		"kGeneric_Ok": 'Ok',
		"kGeneric_Cancel": 'Cancel',
		"kGeneric_Send": 'Send',
		"kGeneric_Understood": 'Understood',

		// Site thingys
		"kSiteButtons_Home": 'Home',
		"kSiteButtons_Languages": 'Languages',

		// VM thingys
		"kVM_UsersOnlineText": 'Users Online:',
		"kVM_TurnTimeTimer": 'Turn expiers in {0} seconds.',
		"kVM_WaitingTurnTimer": 'Waiting for turn in {0} seconds.',
		"kVM_VoteCooldownTimer": 'Please wait {0} seconds before starting anothor vote.',
		"kVM_VoteForResetTitle": 'Do you want to reset the VM?',
		"kVM_VoteForResetTimer": 'Vote ends in {0} seconds.',

		"kVMButtons_TakeTurn": 'Take Turn',
		"kVMButtons_EndTurn": 'End Turn',
		"kVMButtons_ChangeUsername": 'Change Username',
		"kVMButtons_Keyboard": 'Keyboard',
		"kVMButtons_CtrlAltDel": 'CTRL+ALT+DEL',
		"kVMButtons_VoteForReset": 'Vote For Reset',
		"kVMButtons_Screenshot": 'Screenshot',

		// Error thingys
		"kError_UnexpectedDisconnection": "You have been disconnected from the server.",
		"kError_UsernameTaken": "That username is already taken",
		"kError_UsernameInvalid": "Usernames can contain only numbers, letters, spaces, dashes, underscores, and dots, and it must be between 3 and 20 characters.",
		"kError_UsernameBlacklisted": "That username has been blacklisted.",
		"kError_IncorrectPassword": "Incorrect password.",
	}
}

export default fallbackLanguage;