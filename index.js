import { csvParse, autoType } from "https://cdn.jsdelivr.net/npm/d3-dsv/+esm";

const response = await fetch("./data/example.csv");
const dataset = csvParse(await response.text(), autoType);

const columnNames = {
	cardId: "ID",
	mainWord: "Main Word",
	ipa: "IPA",
	partOfSpeech: "Part Of Speech",
	group: "Group",
	chineseTranslation: "Chinese Translation",
	chineseTransliteration: "Chinese Transliteration",
	sentence: "Sentence",
	imageUrl: "Image URL",
	audioUrl: "Audio URL",
};

function resolveResourceUrl(urlValue) {
	if (!urlValue) {
		return "";
	}
	return urlValue.includes("/") ? urlValue : `res/${urlValue}`;
}

/** Loads flashcard progress from local storage if available. */
function loadProgress() {
	const stored = localStorage.getItem("flashcardProgress");
	return stored ? JSON.parse(stored) : {};
}

/** Saves the current progress back to local storage. */
function saveProgress(progress) {
	localStorage.setItem("flashcardProgress", JSON.stringify(progress));
}

// Keep the flashcards in ID order (1–30).
const progressData = loadProgress();
const cards = dataset
	.sort((a, b) => {
		const idA = Number.parseInt(a[columnNames.cardId], 10);
		const idB = Number.parseInt(b[columnNames.cardId], 10);
		return idA - idB;
	});

let currentIndex = 0;

let audioContext = null;

function playProgressSound(type) {
	const AudioContext = window.AudioContext ?? window.webkitAudioContext;
	if (!AudioContext) {
		return;
	}
	if (!audioContext) {
		audioContext = new AudioContext();
	}
	const oscillator = audioContext.createOscillator();
	const gain = audioContext.createGain();

	const toneMap = {
		again: 220,
		good: 440,
		easy: 660,
	};

	oscillator.type = "sine";
	oscillator.frequency.value = toneMap[type] ?? 440;
	oscillator.connect(gain);
	gain.connect(audioContext.destination);

	const now = audioContext.currentTime;
	gain.gain.setValueAtTime(0.0001, now);
	gain.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
	gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

	oscillator.start(now);
	oscillator.stop(now + 0.22);
}

function playClickSound() {
	const AudioContext = window.AudioContext ?? window.webkitAudioContext;
	if (!AudioContext) {
		return;
	}
	if (!audioContext) {
		audioContext = new AudioContext();
	}
	const oscillator = audioContext.createOscillator();
	const gain = audioContext.createGain();

	oscillator.type = "square";
	oscillator.frequency.value = 520;
	oscillator.connect(gain);
	gain.connect(audioContext.destination);

	const now = audioContext.currentTime;
	gain.gain.setValueAtTime(0.0001, now);
	gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
	gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

	oscillator.start(now);
	oscillator.stop(now + 0.09);
}

/** Creates a table row for each card, allowing quick navigation. */
function initEntries() {
	// Build table rows
	for (const [index, card] of cards.entries()) {
		const row = document.createElement("tr");
		row.addEventListener("click", () => {
			currentIndex = index;
			renderCard();
		});
		const cellId = document.createElement("td");
		cellId.textContent = card[columnNames.cardId];
		const cellWord = document.createElement("td");
		cellWord.textContent = card[columnNames.mainWord];
		const cellProgress = document.createElement("td");
		cellProgress.textContent = progressData[card[columnNames.cardId]]?.lastResult ?? "Unseen";

		row.appendChild(cellId);
		row.appendChild(cellWord);
		row.appendChild(cellProgress);
		document.getElementById("entries-body").appendChild(row);
	}
}

/** Updates highlighted row and due dates each time we render or change data. */
function updateEntries() {
	// Update row highlight and due dates
	for (const [index, card] of cards.entries()) {
		const row = document.getElementById("entries-body").children[index];
		row.classList.toggle("row-highlight", index === currentIndex);

		const cellProgress = row.children[row.childElementCount - 1];
		cellProgress.textContent = progressData[card[columnNames.cardId]]?.lastResult ?? "Unseen";
	}
}

const transitionHalfDuration = parseFloat(getComputedStyle(document.getElementById("card-inner")).transitionDuration) * 1000 / 2;
const cardFront = document.querySelector(".card-front");
const cardBack = document.querySelector(".card-back");

const stripeColors = {
	blue: "#3b82f6",
	yellow: "#facc15",
	red: "#ef4444",
	green: "#22c55e",
	purple: "#a855f7",
	orange: "#f97316",
	brown: "#8b5e3c",
	black: "#111827",
	white: "#f8fafc",
	gray: "#9ca3af",
	beige: "#f5f1da",
	ivory: "#fff9e6",
	almond: "#efdfc8",
	sky: "#7dd3fc",
	aqua: "#22d3ee",
	blush: "#fbcfe8",
	cream: "#fff4d6",
	taupe: "#a58a7f",
	rosewood: "#8b4a5a",
	lilac: "#c4b5fd",
	pink: "#f9a8d4",
	mint: "#a7f3d0",
	peach: "#f7b7a3",
	lavender: "#e9d5ff",
	coral: "#fb7185",
	rose: "#f43f5e",
	salmon: "#fda4af",
	plum: "#7c3aed",
	apricot: "#f9c27b",
	lime: "#a3e635",
};

function hexToRgb(hexValue) {
	const normalized = hexValue.replace("#", "");
	if (normalized.length !== 6) {
		return null;
	}
	const red = Number.parseInt(normalized.slice(0, 2), 16);
	const green = Number.parseInt(normalized.slice(2, 4), 16);
	const blue = Number.parseInt(normalized.slice(4, 6), 16);
	return { red, green, blue };
}

function getRelativeLuminance({ red, green, blue }) {
	const normalize = value => {
		const channel = value / 255;
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	};
	const redLinear = normalize(red);
	const greenLinear = normalize(green);
	const blueLinear = normalize(blue);
	return 0.2126 * redLinear + 0.7152 * greenLinear + 0.0722 * blueLinear;
}

function getStripeColor(colorKey) {
	const hexColor = stripeColors[colorKey];
	if (!hexColor) {
		return "rgba(0, 0, 0, 0.2)";
	}
	const rgb = hexToRgb(hexColor);
	if (!rgb) {
		return hexColor;
	}
	const luminance = getRelativeLuminance(rgb);
	if (luminance > 0.75) {
		return "rgba(0, 0, 0, 0.35)";
	}
	if (luminance > 0.6) {
		return "rgba(0, 0, 0, 0.25)";
	}
	return hexColor;
}

function setFrontColorClass(mainWord) {
	for (const className of Array.from(cardFront.classList)) {
		if (className.startsWith("color-")) {
			cardFront.classList.remove(className);
		}
	}

	const colorKey = mainWord?.toString().toLowerCase().replaceAll(" ", "-");
	if (colorKey) {
		cardFront.classList.add(`color-${colorKey}`);
	}

	const stripeColor = getStripeColor(colorKey);
	cardFront.style.setProperty("--stripe-color", stripeColor);
	cardBack.style.setProperty("--stripe-color", stripeColor);
}

/** Renders the current card on both front and back. */
function renderCard() {
	// STUDENTS: Start of recommended modifications
	// If there are more columns in the dataset (e.g., synonyms, example sentences),
	// display them here (e.g., document.getElementById("card-synonym").textContent = currentCard.synonym).

	// Reset flashcard to the front side
	document.getElementById("card-inner").dataset.side = "front";

	// Update the front side with the current card's word and image
	const currentCard = cards[currentIndex];
	const imageUrl = resolveResourceUrl(currentCard[columnNames.imageUrl]);
	const audioUrl = resolveResourceUrl(currentCard[columnNames.audioUrl]);
	const mainWord = currentCard[columnNames.mainWord];

	document.getElementById("image-url").src = imageUrl;
	setFrontColorClass(mainWord);

	// Wait for the back side to become invisible before updating the content on the back side
	setTimeout(() => {
		document.getElementById("id").textContent = currentCard[columnNames.cardId];
		document.getElementById("main-word").textContent = mainWord;
		document.getElementById("ipa").textContent = currentCard[columnNames.ipa];
		document.getElementById("part-of-speech").textContent = currentCard[columnNames.partOfSpeech];
		document.getElementById("group").textContent = currentCard[columnNames.group];
		document.getElementById("chinese-translation").textContent = currentCard[columnNames.chineseTranslation];
		document.getElementById("chinese-transliteration").textContent = currentCard[columnNames.chineseTransliteration];
		document.getElementById("sentence").textContent = currentCard[columnNames.sentence];
		document.getElementById("audio-url").src = audioUrl;
	}, transitionHalfDuration);
	// STUDENTS: End of recommended modifications

	updateEntries();
}

// Toggle the entries list when the hamburger button in the heading is clicked
document.getElementById("toggle-entries").addEventListener("click", () => {
	document.getElementById("entries").hidden = !document.getElementById("entries").hidden;
});

// Flip the card when the card itself is clicked
document.getElementById("card-inner").addEventListener("click", event => {
	// Only flip the card when clicking on the underlying card faces, not any elements inside.
	// This line is unnecessary for other buttons.
	if (!event.target?.classList?.contains("card-face")) return;

	event.currentTarget.dataset.side = event.currentTarget.dataset.side === "front" ? "back" : "front";
});

/** Navigates to the previous card. */
function previousCard() {
	currentIndex = (currentIndex - 1 + cards.length) % cards.length;
}

/** Navigates to the next card. */
function nextCard() {
	currentIndex = (currentIndex + 1) % cards.length;
}

document.getElementById("btn-back").addEventListener("click", () => {
	playClickSound();
	previousCard();
	renderCard();
});
document.getElementById("btn-skip").addEventListener("click", () => {
	playClickSound();
	nextCard();
	renderCard();
});

/**
 * Mapping between the user's selection (Again, Good, Easy) and the number of days until the due date.
 */
const dayOffset = { again: 1, good: 3, easy: 7 };

/**
 * Records learning progress by updating the card's due date based on the user's selection (Again, Good, Easy).
 */
function updateDueDate(type) {
	const card = cards[currentIndex];
	const today = new Date();
	const dueDate = new Date(today.setDate(today.getDate() + dayOffset[type]) - today.getTimezoneOffset() * 60 * 1000);
	(progressData[card[columnNames.cardId]] ??= {}).dueDate = dueDate.toISOString().split("T")[0]; // Print the date in YYYY-MM-DD format
	progressData[card[columnNames.cardId]].lastResult = type[0].toUpperCase() + type.slice(1);
	saveProgress(progressData);
	updateEntries();
}

document.getElementById("btn-again").addEventListener("click", () => {
	playProgressSound("again");
	updateDueDate("again");
	nextCard();
	renderCard();
});
document.getElementById("btn-good").addEventListener("click", () => {
	playProgressSound("good");
	updateDueDate("good");
	nextCard();
	renderCard();
});
document.getElementById("btn-easy").addEventListener("click", () => {
	playProgressSound("easy");
	updateDueDate("easy");
	nextCard();
	renderCard();
});

// Initial render
initEntries();
renderCard();
