const Tigers = {
  // Current language default or stored value
  currentLang: ["en", "mk", "al"].includes(localStorage.getItem("selectedLang"))
    ? localStorage.getItem("selectedLang")
    : "en",
  translations: {},
  pagePhrases: {},
  commonPhrases: {},
  originalText: new WeakMap(),

  // Initialize all features on load
  init() {
    this.ensureLanguageSwitch();
    this.renderFleetCars();
    this.renderVehicleDetails();
    this.populateBookingCars();
    this.initLanguageSwitch();
    this.initFleetFilters();
    this.translationPromise = this.loadTranslations();
    this.initCookieBanner();
  },

  // 1. Fetch JSON translations file & apply
  async loadTranslations() {
    try {
      // Adjust path to your translations JSON file if different (e.g., 'translations.json')
      const [response, phraseResponse] = await Promise.all([
        fetch(new URL("js/translations.json", document.baseURI)),
        fetch(new URL("js/page-translations.json", document.baseURI))
      ]);
      if (!response.ok || !phraseResponse.ok) throw new Error("Failed to load translations");

      [this.translations, this.pagePhrases] = await Promise.all([
        response.json(),
        phraseResponse.json()
      ]);
      for (const lang of ["mk", "al"]) {
        this.commonPhrases[lang] = {};
        for (const [key, source] of Object.entries(this.translations.en)) {
          const target = this.translations[lang]?.[key];
          if (typeof source === "string" && typeof target === "string") {
            this.commonPhrases[lang][source.trim().replace(/\s+/g, " ")] = target;
          }
        }
        Object.assign(this.commonPhrases[lang], this.pagePhrases[lang]);
      }

      // Apply initial language and setup switcher buttons
      this.applyTranslations(this.currentLang);
    } catch (error) {
      console.error("Translation load error:", error);
    }
  },

  // 2. Apply key/value pairs to HTML elements with data-i18n
  applyTranslations(lang) {
    if (!this.translations[lang]) return;

    this.currentLang = lang;
    document.documentElement.lang = lang;
    localStorage.setItem("selectedLang", lang);
    const title = document.querySelector("title");
    if (title) {
      const englishTitle = this.originalText.has(title) ? this.originalText.get(title) : title.textContent;
      this.originalText.set(title, englishTitle);
      title.textContent = lang === "en" ? englishTitle : this.commonPhrases[lang]?.[englishTitle.trim()] || englishTitle;
    }

    // Update HTML text/placeholders
    const elements = document.querySelectorAll("[data-i18n]");
    elements.forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const translation = this.translations[lang][key];

      if (translation !== undefined) {
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          el.placeholder = translation;
        } else {
          el.textContent = translation;
        }
      }
    });

    this.translatePageText(lang);
    this.updateVehicleLanguage(lang);

    // Update language button active styling
    document.querySelectorAll(".lang-switch [data-lang]").forEach((btn) => {
      const active = btn.dataset.lang === lang;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  },

  // 3. Language switcher click listener
  initLanguageSwitch() {
    document.addEventListener("click", async (event) => {
      const button = event.target.closest(".lang-switch [data-lang]");
      if (!button) return;
      if (this.translationPromise) await this.translationPromise;
      this.applyTranslations(button.dataset.lang);
    });
  },

  // 4. Cookie banner handler
  initCookieBanner() {
    let banner = document.querySelector(".cookie-banner");
    if (!banner) {
      banner = document.createElement("aside");
      banner.className = "cookie-banner";
      document.body.append(banner);
    }
    banner.setAttribute("id", "cookieBanner");
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-modal", "false");
    banner.setAttribute("aria-label", "Cookie preferences");
    banner.innerHTML = this.cookieBannerMarkup();

    const preferences = this.getCookiePreferences();
    banner.classList.toggle("show", !preferences);
    this.setCookieControls(banner, preferences || { essential: true, analytics: false, marketing: false });
    this.ensureCookieSettingsButton(banner);

    banner.addEventListener("click", (event) => {
      const action = event.target.closest("[data-cookie-action]")?.dataset.cookieAction;
      if (!action) return;
      if (action === "all") this.saveCookiePreferences({ essential: true, analytics: true, marketing: true });
      if (action === "essential") this.saveCookiePreferences({ essential: true, analytics: false, marketing: false });
      if (action === "settings") banner.classList.add("settings-open");
      if (action === "back") banner.classList.remove("settings-open");
      if (action === "save") {
        this.saveCookiePreferences({
          essential: true,
          analytics: banner.querySelector("[name='cookie-analytics']").checked,
          marketing: banner.querySelector("[name='cookie-marketing']").checked
        });
      }
      if (["all", "essential", "save"].includes(action)) banner.classList.remove("show");
    });
  },

  ensureCookieSettingsButton(banner) {
    let button = document.querySelector(".cookie-settings-trigger");
    if (!button) {
      button = document.createElement("button");
      button.className = "cookie-settings-trigger";
      button.type = "button";
      button.textContent = "Cookie settings";
      document.body.append(button);
    }
    button.addEventListener("click", () => {
      const preferences = this.getCookiePreferences() || { essential: true, analytics: false, marketing: false };
      this.setCookieControls(banner, preferences);
      banner.classList.add("show", "settings-open");
    });
  },

  cookieBannerMarkup() {
    return `
      <div class="cookie-summary">
        <p class="cookie-eyebrow" data-i18n="cookie.title">Your privacy, your choice</p>
        <h2 data-i18n="cookie.heading">We use cookies</h2>
        <p data-i18n="cookie.text">We use essential cookies to run the site and optional analytics to improve it.</p>
        <div class="cookie-actions">
          <button type="button" class="btn btn-primary" data-cookie-action="all" data-i18n="cookie.accept">Accept all</button>
          <button type="button" class="btn btn-ghost" data-cookie-action="essential" data-i18n="cookie.essential">Essential only</button>
          <button type="button" class="cookie-link-button" data-cookie-action="settings" data-i18n="cookie.manage">Manage preferences</button>
        </div>
      </div>
      <div class="cookie-settings" aria-label="Cookie settings">
        <div class="cookie-settings-head">
          <div><p class="cookie-eyebrow" data-i18n="cookie.title">Your privacy, your choice</p><h2 data-i18n="cookie.manageTitle">Cookie preferences</h2></div>
          <button type="button" class="cookie-close" data-cookie-action="back" aria-label="Back">×</button>
        </div>
        <p data-i18n="cookie.settingsText">Choose which optional cookies you allow. Essential cookies are always on.</p>
        <label class="cookie-option"><span><strong data-i18n="cookie.essentialTitle">Essential</strong><small data-i18n="cookie.essentialInfo">Required for the website to work.</small></span><input type="checkbox" checked disabled><i></i></label>
        <label class="cookie-option"><span><strong data-i18n="cookie.analyticsTitle">Analytics</strong><small data-i18n="cookie.analyticsInfo">Helps us understand how visitors use the website.</small></span><input type="checkbox" name="cookie-analytics"><i></i></label>
        <label class="cookie-option"><span><strong data-i18n="cookie.marketingTitle">Marketing</strong><small data-i18n="cookie.marketingInfo">Helps us show relevant offers and advertising.</small></span><input type="checkbox" name="cookie-marketing"><i></i></label>
        <div class="cookie-actions"><button type="button" class="btn btn-primary" data-cookie-action="save" data-i18n="cookie.save">Save preferences</button><button type="button" class="cookie-link-button" data-cookie-action="back" data-i18n="cookie.back">Back</button></div>
      </div>`;
  },

  setCookieControls(banner, preferences) {
    banner.querySelector("[name='cookie-analytics']").checked = Boolean(preferences.analytics);
    banner.querySelector("[name='cookie-marketing']").checked = Boolean(preferences.marketing);
  },

  getCookiePreferences() {
    try {
      const stored = localStorage.getItem("tigers_cookie_preferences");
      if (stored) return JSON.parse(stored);
      const legacy = this.getCookie("tigers_cookie_consent");
      if (legacy) return { essential: true, analytics: legacy === "all", marketing: legacy === "all" };
    } catch (_) { return null; }
    return null;
  },

  saveCookiePreferences(preferences) {
    localStorage.setItem("tigers_cookie_preferences", JSON.stringify(preferences));
    this.setCookie("tigers_cookie_consent", preferences.analytics && preferences.marketing ? "all" : "custom", 180);
    window.dispatchEvent(new CustomEvent("tigers:cookie-preferences", { detail: preferences }));
  },

  ensureLanguageSwitch() {
    const nav = document.querySelector(".nav-inner");
    if (!nav) return;

    let switcher = nav.querySelector(".lang-switch");
    if (!switcher) {
      switcher = document.createElement("div");
      switcher.className = "lang-switch";
      switcher.setAttribute("aria-label", "Choose language");
      const actions = nav.querySelector(".nav-actions");
      if (actions) actions.prepend(switcher);
      else nav.append(switcher);
    }

    if (!switcher.querySelector("[data-lang]")) {
      switcher.innerHTML = `<button type="button" data-lang="en" aria-label="English">EN</button><button type="button" data-lang="mk" aria-label="Macedonian">MK</button><button type="button" data-lang="al" aria-label="Albanian">AL</button>`;
    }
  },

  initFleetFilters() {
    const filters = document.querySelectorAll(".fleet-filters [data-filter]");
    const cars = [...document.querySelectorAll(".fleet-grid .car-item[data-category]")];
    const emptyMessage = document.querySelector(".fleet-empty");
    if (!filters.length || !cars.length) return;

    filters.forEach((button) => {
      button.addEventListener("click", () => {
        const category = button.dataset.filter;
        let visibleCars = 0;

        cars.forEach((car) => {
          const matches = category === "all" || car.dataset.category.split(/\s+/).includes(category);
          car.hidden = !matches;
          if (matches) visibleCars += 1;
        });

        filters.forEach((filter) => {
          const active = filter === button;
          filter.classList.toggle("active", active);
          filter.setAttribute("aria-pressed", String(active));
        });

        if (emptyMessage) emptyMessage.hidden = visibleCars !== 0;
      });
    });
  },

  renderFleetCars() {
    const grid = document.querySelector(".fleet-grid");
    const cars = window.TIGERS_CARS;
    if (!grid || !Array.isArray(cars)) return;

    grid.replaceChildren(...cars.map((car) => {
      const card = document.createElement("a");
      card.className = "car-item";
      card.dataset.category = car.category;
      card.href = car.detailPage || `vehicle.html?car=${encodeURIComponent(car.slug)}`;

      const image = document.createElement("img");
      image.src = car.image;
      image.alt = car.name;

      const meta = document.createElement("div");
      meta.className = "car-meta";
      const name = document.createElement("h3");
      name.textContent = car.name;
      const category = document.createElement("p");
      category.className = "muted";
      category.textContent = car.categoryLabel;
      const price = document.createElement("div");
      price.className = "car-price";
      const amount = document.createElement("strong");
      amount.textContent = `${car.price}€`;
      const perDay = document.createElement("span");
      perDay.textContent = "/ day";

      price.append(amount, perDay);
      meta.append(name, category, price);
      card.append(image, meta);
      return card;
    }));
  },

  renderVehicleDetails() {
    const page = document.querySelector("[data-vehicle-detail]");
    const cars = window.TIGERS_CARS;
    if (!page || !Array.isArray(cars)) return;

    const car = cars.find((item) => item.slug === new URLSearchParams(location.search).get("car"));
    if (!car) {
      page.innerHTML = `<div class="container"><h1>Vehicle not found</h1><a class="btn btn-primary" href="fleet.html">Back to fleet</a></div>`;
      return;
    }

    page.querySelector("[data-vehicle-name]").textContent = car.name;
    page.querySelector("[data-vehicle-price]").textContent = `${car.price}€`;
    page.querySelector("[data-vehicle-image]").src = car.image;
    page.querySelector("[data-vehicle-image]").alt = car.name;
    page.querySelector("[data-vehicle-year]").textContent = car.year;
    page.querySelector("[data-vehicle-seats]").textContent = car.seats;
    page.querySelector("[data-vehicle-transmission]").textContent = car.transmission;
    page.querySelector("[data-vehicle-fuel]").textContent = car.fuel;
    page.querySelector("[data-vehicle-category]").textContent = car.categoryLabel.split(" • ")[0];
    page.querySelector("[data-vehicle-description]").textContent = car.description;
    page.querySelector("[data-vehicle-features]").replaceChildren(...car.features.map((feature) => {
      const item = document.createElement("li");
      item.textContent = feature;
      return item;
    }));
    page.querySelector("[data-vehicle-book]").href = `booking.html?car=${encodeURIComponent(car.slug)}`;
    document.title = `Tigers Car Rental | ${car.name}`;
    this.activeVehicle = car;
  },

  updateVehicleLanguage(lang) {
    if (!this.activeVehicle) return;
    const description = document.querySelector("[data-vehicle-description]");
    if (description) {
      description.textContent = lang === "mk"
        ? this.activeVehicle.descriptionMk
        : lang === "al" ? this.activeVehicle.descriptionAl : this.activeVehicle.description;
    }
  },

  populateBookingCars() {
    const select = document.querySelector("#booking-car");
    const cars = window.TIGERS_CARS;
    if (!select || !Array.isArray(cars)) return;

    select.replaceChildren(...cars.map((car) => {
      const option = document.createElement("option");
      option.value = car.slug;
      option.textContent = car.name;
      return option;
    }));
    const requestedCar = new URLSearchParams(location.search).get("car");
    if (requestedCar && cars.some((car) => car.slug === requestedCar)) select.value = requestedCar;
  },

  translatePageText(lang) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || parent.closest("[data-i18n], script, style, .logo-text, .lang-switch")) continue;

      if (!this.originalText.has(node)) this.originalText.set(node, node.nodeValue);
      const original = this.originalText.get(node);
      const phrase = original.trim().replace(/\s+/g, " ");
      if (!phrase) continue;

      const translated = lang === "en" ? phrase : this.commonPhrases?.[lang]?.[phrase];
      if (translated === undefined) continue;
      const leading = original.match(/^\s*/)?.[0] || "";
      const trailing = original.match(/\s*$/)?.[0] || "";
      node.nodeValue = `${leading}${translated}${trailing}`;
    }
  },

  getCookie(name) {
    return document.cookie.split("; ").find((item) => item.startsWith(`${name}=`))?.split("=")[1];
  },

  setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
  }
};

// Auto-run when DOM content loads
document.addEventListener("DOMContentLoaded", () => {
  Tigers.init();
});

// Layout initialization helper if needed elsewhere
function initLayout(page) {
  // Page specific logic
}
