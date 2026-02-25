import CVMClient from "./cvm/CVMClient.js";
import { Permissions, Rank } from "./cvm/Permissions.js";
import { User } from "./cvm/User.js";
import MuteState from "./cvm/MuteState.js";
import { I18nStringKey, TheI18n } from "./i18n.js";
import { Format } from "./format.js";

import type VM from "./cvm/VM.js";
import type TurnStatus from "./cvm/TurnStatus.js";
import type VoteStatus from "./cvm/VoteStatus.js";

import Config from '../../config.json';

import "../css/style.css";
import "../css/frontend.css";

import dayjs from 'dayjs';
import DOMPurify from 'dompurify';

const _eval = window.eval;

const w = window as any;
const elements = {
	//TODO Add all of the web elements of the index page into here.
	//* Site buttons
	homeBtn: document.getElementById('homeBtn') as HTMLAnchorElement,

	//* VM stuff
	vmList: document.getElementById('vmList') as HTMLDivElement,
	vmView: document.getElementById('vmView') as HTMLDivElement,
	vmDisplay: document.getElementById('vmDisplay') as HTMLDivElement,
	vmName: document.getElementById('vmName') as HTMLHeadingElement,
	username: document.getElementById('username') as HTMLSpanElement,
	chatInput: document.getElementById('chatInput') as HTMLInputElement,
	chatList: document.getElementById('chatList') as HTMLTableSectionElement,
	chatListDiv: document.getElementById('chatListDiv') as HTMLDivElement,
	userList: document.getElementById('userList') as HTMLDivElement,
	onlineUserCount: document.getElementById('onlineUserCount') as HTMLSpanElement,
	turnStatus: document.getElementById('turnStatus') as HTMLParagraphElement,

	//* VM buttons
	sendChatBtn: document.getElementById('sendChatBtn') as HTMLButtonElement,
	takeTurnBtn: document.getElementById('takeTurnBtn') as HTMLButtonElement,
	changeUsernameBtn: document.getElementById('changeUsernameBtn') as HTMLButtonElement,
	screenshotBtn: document.getElementById('screenshotBtn') as HTMLButtonElement,
	voteResetButton: document.getElementById('voteResetButton') as HTMLButtonElement,
	turnBtnText: document.getElementById('turnBtnText') as HTMLSpanElement,

	//* VM admin
	xssCheckboxContainer: document.getElementById('xssCheckboxContainer') as HTMLDivElement,
	xssCheckbox: document.getElementById('xssCheckbox') as HTMLInputElement,
	loginModal: document.getElementById('loginModal') as HTMLDivElement,
	adminPassword: document.getElementById('adminPassword') as HTMLInputElement,
	loginButton: document.getElementById('loginButton') as HTMLButtonElement,
	adminInputVMID: document.getElementById('adminInputVMID') as HTMLInputElement,
	badPasswordAlert: document.getElementById('badPasswordAlert') as HTMLDivElement,
	incorrectPasswordDismissBtn: document.getElementById('incorrectPasswordDismissBtn') as HTMLButtonElement,
};

interface UserEntry {
	user: User;
	element: HTMLDivElement;
	usernameElement: HTMLSpanElement;
	flagElement?: HTMLSpanElement;
}

let expectedClose = false;
let usernameClick = false;

let turn = -1;

let turnInterval: number | null = null;
let voteInterval: number | null = null;

let turnTimer = 0;
let voteTimer = 0;

let rank: Rank = Rank.Unregistered;
let perms: Permissions = new Permissions(0);

const vms: VM[] = [];
const cards: HTMLDivElement[] = [];
const users: Map<string, UserEntry> = new Map();

let VM: CVMClient | null = null;

type ModalType = "info" | "warning" | "error" | "success";

interface ModalOptions {
    title?: string;
    message: string;
    type?: ModalType;
    confirmText?: string;
    dismissible?: boolean;
    onConfirm?: () => void;
}

function showSiteModal(options: ModalOptions) {
    const container = document.getElementById("siteModalContainer");
    if (!container) return;

    const {
        title = "Notice",
        message,
        type = "info",
        confirmText = "OK",
        dismissible = true,
        onConfirm
    } = options;

    const colors = {
        info: "bg-blue-600",
        warning: "bg-yellow-500",
        error: "bg-red-600",
        success: "bg-green-600"
    };

    document.body.style.overflow = "hidden";

    const overlay = document.createElement("div");
    overlay.className = `
        fixed inset-0 z-50
        bg-black/70 backdrop-blur-sm
        flex items-center justify-center
        px-4
    `;

    const modal = document.createElement("div");
    modal.className = `
        w-full max-w-md
        bg-zinc-900 border border-zinc-800
        rounded-2xl shadow-2xl
        overflow-hidden
        animate-fade-in
    `;

    modal.innerHTML = `
        <div class="${colors[type]} px-6 py-4 text-white font-semibold">
            ${title}
        </div>
        <div class="p-6 text-sm text-zinc-300">
            ${message}
        </div>
        <div class="px-6 py-4 flex justify-end gap-3 border-t border-zinc-800">
            ${dismissible ? `<button id="modalCancel" class="px-4 py-2 bg-zinc-700 rounded-lg hover:bg-zinc-600 transition">Cancel</button>` : ""}
            <button id="modalConfirm" class="px-4 py-2 btn-primary">
                ${confirmText}
            </button>
        </div>
    `;

    overlay.appendChild(modal);
    container.appendChild(overlay);

    function close() {
        document.body.style.overflow = "";
        overlay.remove();
    }

    if (dismissible) {
        modal.querySelector("#modalCancel")?.addEventListener("click", close);
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) close();
        });
    }

    modal.querySelector("#modalConfirm")?.addEventListener("click", () => {
        onConfirm?.();
        close();
    });
}


function handleConfigSiteAlert() {
    const alertConfig = Config.SiteAlert;
    if (!alertConfig) return;

    if (alertConfig.showOnce) {
        const dismissed = localStorage.getItem("siteAlertDismissed");
        if (dismissed === "true") return;
    }

    showSiteModal({
        title: alertConfig.title ?? "Notice",
        message: DOMPurify.sanitize(alertConfig.message),
        type: alertConfig.type as ModalType ?? "info",
        dismissible: alertConfig.dismissible ?? true,
        onConfirm: () => {
            if (alertConfig.showOnce) {
                localStorage.setItem("siteAlertDismissed", "true");
            }
        }
    });
}

async function multicollab(url: string) {
	let client = new CVMClient(url);
	await client.WaitForOpen();

	let list = await client.list();
	let online = client.getUsers().length;

	client.close();

	vms.push(...list);

	for (let vm of list) {
		let wrapper = document.createElement('div');

		wrapper.classList.add('w-full', 'sm:w-1/2', 'md:w-1/4', 'px-4', 'mb-8');

		let card = document.createElement('div');

		card.classList.add(
			'group',
			'relative',
			'bg-white',
			'dark:bg-zinc-900',
			'rounded-xl',
			'shadow-sm',
			'transition-all',
			'duration-300',
			'ease-out',
			'hover:-translate-y-2',
			'cursor-pointer',
			'transition-shadow',
			'hover:shadow-[0_0_25px_rgba(59,130,246,0.7)]'
		);

		if (Config.NSFWVMs.indexOf(vm.id) !== -1) {
			card.classList.add('ring-2', 'ring-pink-500/60');
		}

		card.setAttribute('data-cvm-node', vm.id);

		card.addEventListener('click', async () => {
			try {
				await openVM(vm);
			} catch (e) {
				alert((e as Error).message);
			}
		});

		let imageWrapper = document.createElement('div');
		imageWrapper.classList.add('relative', 'overflow-hidden');

		vm.thumbnail.classList.add('w-full', 'h-48', 'object-cover', 'transition-transform', 'duration-500', 'group-hover:scale-110');

		imageWrapper.appendChild(vm.thumbnail);

		if (Config.NSFWVMs.indexOf(vm.id) !== -1) {
			let nsfwBadge = document.createElement('span');
			nsfwBadge.classList.add('absolute', 'top-3', 'left-3', 'bg-pink-600', 'text-white', 'text-xs','font-bold', 'px-2', 'py-1', 'rounded-md', 'shadow');
			nsfwBadge.innerText = 'NSFW';
			imageWrapper.appendChild(nsfwBadge);
		}

		card.appendChild(imageWrapper);

		let cardBody = document.createElement('div');
		cardBody.classList.add('p-5', 'space-y-3');

		let cardTitle = document.createElement('h3');
		cardTitle.classList.add('text-lg', 'font-semibold', 'text-gray-800', 'dark:text-gray-100', 'line-clamp-1');

		cardTitle.innerHTML = Config.RawMessages.VMTitles
			? vm.displayName
			: DOMPurify.sanitize(vm.displayName);

		let usersOnline = document.createElement('span');
		usersOnline.classList.add('inline-flex', 'items-center', 'gap-1', 'bg-blue-100', 'dark:bg-blue-900/40', 'text-blue-700', 'dark:text-blue-300', 'text-xs', 'font-medium', 'px-2.5', 'py-1', 'rounded-full');

		usersOnline.innerHTML = `<i class="fa-solid fa-users text-[10px]"></i> ${online}`;

		cardBody.appendChild(cardTitle);
		cardBody.appendChild(usersOnline);

		card.appendChild(cardBody);
		wrapper.appendChild(card);

		cards.push(wrapper);

		sortVMList();
	}
}

async function openVM(vm: VM): Promise<void> {
	if (VM !== null) return;

	expectedClose = false;
	location.hash = vm.id;

	VM = new CVMClient(vm.url);

	VM!.on('chat', (username, message) => chatMessage(username, message));
	VM!.on('adduser', (user) => addUser(user));
	// VM!.on('flag', () => flag());
	VM!.on('remuser', (user) => remUser(user));
	VM!.on('rename', (oldname, newname, selfrename) => userRenamed(oldname, newname, selfrename));

	VM!.on('renamestatus', (status) => {
		// TODO: i18n these
		switch (status) {
			case 'taken':
				alert(TheI18n.getString(I18nStringKey.kError_UsernameTaken));
				break;
			case 'invalid':
				alert(TheI18n.getString(I18nStringKey.kError_UsernameInvalid));
				break;
			case 'blacklisted':
				alert(TheI18n.getString(I18nStringKey.kError_UsernameBlacklisted));
				break;
		}
	});

	VM!.on('turn', (status) => turnUpdate(status));
	VM!.on('vote', (status: VoteStatus) => voteUpdate(status));
	VM!.on('voteend', () => voteEnd());
	VM!.on('votecd', (voteCooldown) => window.alert(TheI18n.getString(I18nStringKey.kVM_VoteCooldownTimer, voteCooldown)));
	VM!.on('login', (rank: Rank, perms: Permissions) => onLogin(rank, perms));

	VM!.on('close', () => {
		if (!expectedClose)
			alert(TheI18n.getString(I18nStringKey.kError_UnexpectedDisconnection));
		closeVM();
	});

	await VM!.WaitForOpen();

	chatMessage('', `<b>${vm.id}</b><hr>`);

	let username = localStorage.getItem('username');
	let connected = await VM.connect(vm.id, username);

	elements.adminInputVMID.value = vm.id;

	w.VMName = vm.id;

	if (!connected) {
		closeVM();
		throw new Error('Failed to connect to node');
	}

	document.title = "CollabVM";

	elements.vmName.innerHTML = `${vm.displayName} | VIRTUAL MACHINE`;
	elements.vmDisplay.appendChild(VM!.canvas);
	elements.vmList.style.display = 'none';
	elements.vmView.style.display = 'block';
	return;
}

function closeVM() {
	if (VM === null)
		return;
	expectedClose = true;

	VM.close();
	VM = null;

	turn = -1;

	elements.chatList.innerHTML = ''; // Easy fix for the chat list to not go off screen
	
	//* VM stuff - What else, I'm a suppose to title this comment
	elements.vmDisplay.innerHTML = '';
	elements.vmList.style.display = 'block';
	elements.vmView.style.display = 'none';

	elements.xssCheckboxContainer.style.display = 'none';
	elements.xssCheckbox.checked = false;
	elements.username.classList.remove('username-admin', 'username-moderator', 'username-registered');
	elements.username.classList.add('username-unregistered');
	elements.changeUsernameBtn.style.display = 'inline-block';

	users.clear();
	elements.userList.innerHTML = '';
	
	rank = Rank.Unregistered;
	
	perms.set(0);

	w.VMName = null;
}

async function loadList() {
	var jsonVMs = Config.ServerAddressesListURI === null ? [] : await (await fetch(Config.ServerAddressesListURI)).json();
	await Promise.all(
		[Config.ServerAddresses, jsonVMs].flat().map((url) => {
			return multicollab(url);
		})
	);

	let v = vms.find((v) => v.id === window.location.hash.substring(1));
	try {
		if (v !== undefined) await openVM(v);
	} catch (e) {
		alert((e as Error).message);
	}
}

function sortVMList() {
	cards.sort((a, b) => {
		return a.children[0].getAttribute('data-cvm-node')! > b.children[0].getAttribute('data-cvm-node')! ? 1 : -1;
	});

	elements.vmList.children[0].innerHTML = '';
	cards.forEach((c) => elements.vmList.children[0].appendChild(c));
}

function sortUserList() {
	const sortedUsers = Array.from(users.values());

	sortedUsers.sort((a, b) => {
		if (a.user.username === w.username && a.user.turn >= b.user.turn && b.user.turn !== 0)
			return -1;

		if (b.user.username === w.username && b.user.turn >= a.user.turn && a.user.turn !== 0)
			return 1;

		if (a.user.turn === b.user.turn)
			return 0;

		if (a.user.turn === -1)
			return 1;

		if (b.user.turn === -1)
			return -1;

		if (a.user.turn < b.user.turn)
			return -1;
		else
			return 1;
	});

	for (const user of users) {
		elements.userList.removeChild(user[1].element);
		elements.userList.appendChild(user[1].element);
	}
}

function chatMessage(username: string, message: string) {
    if (!Config.RawMessages.Messages) message = DOMPurify.sanitize(message);

    const msgWrapper = document.createElement('div');
    msgWrapper.className = 'flex items-start gap-2 py-1 px-2';

    let msgClass = '';
    let userClass = '';

    if (username === '') {
        msgWrapper.innerHTML = message;
    } else {
        const user = VM!.getUsers().find(u => u.username === username);
        const rank = user ? user.rank : Rank.Unregistered;

        switch (rank) {
            case Rank.Unregistered:
                userClass = 'chat-username-unregistered text-gray-500 font-medium';
                msgClass = 'chat-unregistered text-gray-700';
                break;
            case Rank.Registered:
                userClass = 'chat-username-registered text-green-600 font-medium';
                msgClass = 'chat-registered text-gray-800';
                break;
            case Rank.Admin:
                userClass = 'chat-username-admin text-red-600 font-semibold';
                msgClass = 'chat-admin text-gray-800';
                break;
            case Rank.Moderator:
                userClass = 'chat-username-moderator text-blue-600 font-semibold';
                msgClass = 'chat-moderator text-gray-800';
                break;
        }

        msgWrapper.className = msgClass;

        const userSpan = document.createElement('span');
        userSpan.className = userClass;
        userSpan.textContent = `${username}▸`;

        const msgSpan = document.createElement('span');
        msgSpan.className = msgClass;
        msgSpan.innerHTML = message;

        msgWrapper.append(userSpan, msgSpan);
    }

    if (Config.RawMessages.Messages) {
        Array.from(msgWrapper.children).forEach((child) => {
            if (child.nodeName === 'SCRIPT') {
                _eval((child as HTMLScriptElement).text);
            }
        });
    }

    elements.chatList.appendChild(msgWrapper);
    elements.chatListDiv.scrollTop = elements.chatListDiv.scrollHeight;
}

function addUser(user: User) {
	if (!user.username || typeof user.username !== 'string') {
		console.warn('Invalid username:', user);
		return;
	}

	const existing = users.get(user.username);

	if (existing) {
		existing.user = user;
		existing.usernameElement.textContent = user.username;
		return;
	}

	const wrapper = document.createElement('div');
	wrapper.setAttribute('data-cvm-turn', String(user.turn));
	wrapper.className =
		"flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700";

	const usernameSpan = document.createElement('span');
	usernameSpan.textContent = user.username;

	switch (user.rank) {
		case Rank.Admin:
			usernameSpan.classList.add('text-red-600', 'font-semibold');
			usernameSpan.innerHTML = `<i class='fa-solid fa-hammer'></i> ${user.username}`
			break;
		case Rank.Moderator:
			usernameSpan.classList.add('text-blue-600', 'font-semibold');
			usernameSpan.innerHTML = `<i class='fa-solid fa-hammer'></i> ${user.username}`
			break;
		case Rank.Registered:
			usernameSpan.classList.add('text-green-600');
			usernameSpan.innerHTML = `<i class='fa-solid fa-user'></i> ${user.username}`
			break;
		case Rank.Unregistered:
			usernameSpan.classList.add('text-gray-500');
			usernameSpan.innerHTML = `<i class='fa-solid fa-user'></i> ${user.username}`
			break;
	}

	if (user.username === w.username) {
		wrapper.classList.add('bg-yellow-100', 'dark:bg-yellow-800');
	}

	wrapper.append(usernameSpan);

	const entry: UserEntry = {
		user,
		element: wrapper,
		usernameElement: usernameSpan
	};

	if (rank === Rank.Admin || rank === Rank.Moderator) {
		userModOptions(entry);
	}

	elements.userList.appendChild(wrapper);
	users.set(user.username, entry);
	elements.onlineUserCount.textContent = users.size.toString();
}

function remUser(user: User) {
	const entry = users.get(user.username);
	if (!entry) return;

	elements.userList.removeChild(entry.element);

	users.delete(user.username);

	elements.onlineUserCount.textContent = users.size.toString();
}

function getFlagEmoji(countryCode: string) {

}

function flag() {

}

function userRenamed(oldname: string, newname: string, selfrename: boolean) {
	const entry = users.get(oldname);
	if (!entry) return;

	entry.user.username = newname;
	entry.usernameElement.textContent = newname;

	users.delete(oldname);
	users.set(newname, entry);

	if (selfrename) {
		w.username = newname;
		elements.username.textContent = newname;
		localStorage.setItem('username', newname);
	}
}

function turnUpdate(status: TurnStatus) {
    turn = -1;
    turnTimer = 0;

    VM!.canvas.classList.remove('focused', 'waiting');

    if (turnInterval !== null) {
        clearInterval(turnInterval);
        turnInterval = null;
    }

    for (const entry of users.values()) {
        entry.element.classList.remove('user-turn', 'user-waiting');
        entry.element.setAttribute('data-cvm-turn', '-1');
    }

    if (!status.user) {
        elements.turnStatus.innerText = '';
        sortUserList();
        return;
    }

    const currentEntry = users.get(status.user.username);
    if (currentEntry) {
        currentEntry.element.classList.add('user-turn');
        currentEntry.element.setAttribute('data-cvm-turn', '0');
    }

    status.queue.forEach((u, i) => {
        const entry = users.get(u.username);
        if (!entry) return;
        entry.element.classList.add('user-waiting');
        entry.element.setAttribute('data-cvm-turn', i.toString());
    });

    if (status.user.username === w.username) {
        turn = 0;
        turnTimer = (status.turnTime ?? 0) / 1000;
        elements.turnBtnText.innerHTML = TheI18n.getString(I18nStringKey.kVMButtons_EndTurn);
        VM!.canvas.classList.add('focused');
    } else if (status.queue.some(u => u.username === w.username)) {
        turn = status.queue.findIndex(u => u.username === w.username) + 1;
        turnTimer = (status.queueTime ?? 0) / 1000;
        elements.turnBtnText.innerHTML = TheI18n.getString(I18nStringKey.kVMButtons_EndTurn);
        VM!.canvas.classList.add('waiting');
    } else {
        turnTimer = (status.turnTime ?? 0) / 1000;
    }

    if (turnTimer > 0) {
        turnInterval = window.setInterval(turnIntervalCb, 1000);
        setTurnStatus();
    } else {
        elements.turnStatus.innerText = '';
    }

    sortUserList();
}

function voteUpdate(status: VoteStatus) {

}

function updateVoteEndTime() {

}

function voteEnd() {

}

function turnIntervalCb() {
    if (turnTimer > 0) {
        turnTimer--;
        setTurnStatus();
    } else {
        clearInterval(turnInterval!);
        turnInterval = null;
        elements.turnStatus.innerText = '';
    }
}

function setTurnStatus() {
    if (!elements.turnStatus) return;

    let i18nKey: I18nStringKey;
    if (turn === 0) {
        i18nKey = I18nStringKey.kVM_TurnTimeTimer;
    } else if (turn > 0) {
        i18nKey = I18nStringKey.kVM_WaitingTurnTimer;
    } else {
        // Spectator or no turn
        i18nKey = I18nStringKey.kVM_TurnTimeTimer;
    }

    const seconds = Math.max(0, Math.floor(turnTimer));

    let formatted = '';
    try {
        formatted = TheI18n.getString(i18nKey, seconds);
    } catch (err) {
        console.warn('Error formatting i18n string for turn timer:', err);

        if (turn === 0)
			formatted = `Your turn: ${seconds}s`;
        else if (turn > 0)
			formatted = `Waiting: ${seconds}s`;
        else formatted = `Turn timer: ${seconds}s`;
    }

    elements.turnStatus.innerText = formatted;
}

function sendChat() {
	if (VM === null)
		return;
	if (elements.xssCheckbox.checked)
		VM.xss(elements.chatInput.value);
	else
		VM.chat(elements.chatInput.value);
	elements.chatInput.value = '';

}

const loginModal = elements.loginModal as HTMLDivElement;
const adminPassword = elements.adminPassword as HTMLInputElement;

function showLoginModal() {
	loginModal.classList.remove('hidden');
	adminPassword.focus();
}

function hideLoginModal() {
	loginModal.classList.add('hidden');
}

const closeBtns = [
	document.getElementById('loginModalCloseBtn'),
	document.getElementById('incorrectPasswordDismissBtn')
];
closeBtns.forEach(btn => {
	btn?.addEventListener('click', hideLoginModal);
});

elements.username.addEventListener('click', () => {
	if (!usernameClick) {
		usernameClick = true;

		setTimeout(() => (usernameClick = false), 1000);
		return;
	}
	showLoginModal();
});
elements.loginButton.addEventListener('click', () => doLogin());
elements.adminPassword.addEventListener('keypress', (e) => e.key === 'Enter' && doLogin());
elements.incorrectPasswordDismissBtn.addEventListener('click', () => (elements.badPasswordAlert.style.display = 'none'));

function doLogin() {
	let adminPass = elements.adminPassword.value;

	if (adminPass === '') return;

	VM?.login(adminPass);

	elements.adminPassword.value = '';

	let u = VM?.on('login', () => {
		u!();
		loginModal.classList.add('hidden');
		elements.badPasswordAlert.style.display = 'none';
	});

	let _u = VM?.on('badpw', () => {
		_u!();
		elements.badPasswordAlert.style.display = 'block';
	});
}

function onLogin(_rank: Rank, _perms: Permissions) {
	rank = _rank;
	perms = _perms;

	elements.username.classList.remove('username-unregistered', 'username-registered');

	if (rank === Rank.Admin)
		elements.username.classList.add('username-admin');
	if (rank === Rank.Moderator)
		elements.username.classList.add('username-moderator');
	if (rank === Rank.Registered)
		elements.username.classList.add('username-registered');
}

function userModOptions(user: { user: User; element: HTMLDivElement } ) {

}

elements.homeBtn.addEventListener('click', () => closeVM());
elements.sendChatBtn.addEventListener('click', sendChat);
elements.chatInput.addEventListener('keypress', (e) => {
	if (e.key === 'Enter')
		sendChat();
});
elements.changeUsernameBtn.addEventListener('click', () => {
	let oldname = w.username.nodeName === undefined ? w.username : w.username.innerText;
	let newname = prompt(TheI18n.getString(I18nStringKey.kVMPrompts_EnterNewUsernamePrompt), oldname);

	if (newname === oldname)
		return;
	VM?.rename(newname);
});
elements.takeTurnBtn.addEventListener('click', () => {
	VM?.turn(turn === -1);
});
elements.screenshotBtn.addEventListener('click', () => {
	if (!VM) return;

	VM.canvas.toBlob((blob) => {
		open(URL.createObjectURL(blob!), '_blank');
	});
});

// API
w.collabvm = {
	openVM: openVM,
	closeVM: closeVM,
	loadList: loadList,
	multicollab: multicollab,
	getVM: () => VM
};
w.multicollab = multicollab;
w.GetAdmin = () => {

};
w.cvmEvents + {

};
w.VMName = null;

document.addEventListener('DOMContentLoaded', async () => {
	loadList();

	if (Config.SiteAlert?.enabled) {
		handleConfigSiteAlert();
	}

	await TheI18n.Init();

	TheI18n.on('languageChanged', lang => {
		if (VM) {
			document.title = Format('{0} - {1}', VM.getNode()!, TheI18n.getString(I18nStringKey.kGeneric_CollabVM));

			if (turn !== -1) {
				if (turn === 0)
					elements.turnStatus.innerText = TheI18n.getString(I18nStringKey.kVM_TurnTimeTimer, turnTimer);
				else
					elements.turnStatus.innerText = TheI18n.getString(I18nStringKey.kVM_WaitingTurnTimer, turnTimer);
				elements.turnBtnText.innerText = TheI18n.getString(I18nStringKey.kVMButtons_EndTurn);
			}
			else
				elements.turnBtnText.innerText = TheI18n.getString(I18nStringKey.kVMButtons_TakeTurn);
			if (VM!.getVoteStatus())
				console.log("VOTE STARTED");
		}
		else {
			document.title = TheI18n.getString(I18nStringKey.kGeneric_CollabVM);
		}
	});
});