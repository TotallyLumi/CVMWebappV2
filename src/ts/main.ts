import CVMClient from "./cvm/CVMClient.js";
import { Permissions, Rank } from "./cvm/Permissions.js";
import { User } from "./cvm/User.js";
import MuteState from "./cvm/MuteState.js";

import type VM from "./cvm/VM.js";
import type TurnStatus from "./cvm/TurnStatus.js";
import type VoteStatus from "./cvm/VoteStatus.js";

import Config from '../../config.json';

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

		card.classList.add('group', 'relative', 'bg-white', 'dark:bg-zinc-900', 'rounded-xl', 'overflow-hidden', 'shadow-md', 'transition-all', 'duration-300', 'ease-out', 'hover:-translate-y-2', 'hover:shadow-2xl', 'cursor-pointer');

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
});