import CVMClient from "./cvm/CVMClient.js";
import { Permissions, Rank } from "./cvm/Permissions.js";
import { User } from "./cvm/User.js";
import MuteState from "./cvm/MuteState.js";

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
	//* VM stuff
	vmlist: document.getElementById('vmList') as HTMLDivElement,
	vmview: document.getElementById('vmView') as HTMLDivElement,
	vmdisplay: document.getElementById('vmDisplay') as HTMLDivElement,
	vmname: document.getElementById('vmName') as HTMLHeadingElement,
};

let expectedClose = false;
let turn = -1;

let turnInterval: number | undefined = undefined;
let voteInterval: number | undefined = undefined;

let turnTimer = 0;
let voteTimer = 0;

let rank: Rank = Rank.Unregistered;
let perms: Permissions = new Permissions(0);

const vms: VM[] = [];
const cards: HTMLDivElement[] = [];
const users: {
	user: User,
	usernameElement: HTMLSpanElement;
	flagElement: HTMLSpanElement;
	element: HTMLTableRowElement;
}[] = [];

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

	await VM!.WaitForOpen();

	let username = localStorage.getItem('username');
	let connected = await VM.connect(vm.id, username);

	if (!connected) {
		closeVM();
		throw new Error('Failed to connect to node');
	}

	document.title = "CollabVM";

	elements.vmname.innerHTML = `${vm.displayName} | VIRTUAL MACHINE`;
	elements.vmdisplay.appendChild(VM!.canvas);
	elements.vmlist.style.display = 'none';
	elements.vmview.style.display = 'block';
	return;
}

function closeVM() {

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

	elements.vmlist.children[0].innerHTML = '';
	cards.forEach((c) => elements.vmlist.children[0].appendChild(c));
}

document.addEventListener('DOMContentLoaded', async () => {
	loadList();

	if (Config.SiteAlert?.enabled) {
		handleConfigSiteAlert();
	}
});