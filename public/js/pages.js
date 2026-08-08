let translations = {};
let currentLanguage = "en";


// Load translations
async function loadTranslations() {
    const response = await fetch("languages/translations.json");
    translations = await response.json();

    changeLanguage(currentLanguage);
}


// Change language
function changeLanguage(language) {

    currentLanguage = language;

    document.querySelectorAll("[data-i18n]").forEach(element => {

        const key = element.getAttribute("data-i18n");

        if (translations[language][key]) {
            element.textContent = translations[language][key];
        }

    });


    // change active language button
    document.querySelectorAll(".lang-switch button").forEach(btn => {
        btn.classList.remove("active");
    });

    const activeButton = document.querySelector(`[data-lang="${language}"]`);

    if(activeButton){
        activeButton.classList.add("active");
    }

}



// Cookie banner

function acceptCookies(){

    localStorage.setItem("cookies", "accepted");

    document.querySelector(".cookie-banner")
        .classList.remove("show");

}



function essentialCookies(){

    localStorage.setItem("cookies", "essential");

    document.querySelector(".cookie-banner")
        .classList.remove("show");

}



// Show cookie popup

function checkCookies(){

    if(!localStorage.getItem("cookies")){

        document.querySelector(".cookie-banner")
            .classList.add("show");

    }

}



// Start everything

document.addEventListener("DOMContentLoaded", () => {

    loadTranslations();

    checkCookies();

});