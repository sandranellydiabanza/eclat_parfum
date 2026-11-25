
document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // 1. RÉCUPÉRATION DES ÉLÉMENTS HTML
    // ==========================================

    const productCards = document.querySelectorAll(".product-card");

    const cartButton = document.querySelector(
        '.header-icons button[aria-label="Panier"]'
    );

    const cartCount = document.querySelector(".cart-count");
    const participationForm = document.getElementById("participationForm");
    const formMessage = document.getElementById("formMessage");
    const submitButton = document.getElementById("submitButton");

    if (
        !cartButton ||
        !cartCount ||
        !participationForm ||
        !formMessage ||
        !submitButton
    ) {
        console.error("Certains éléments HTML sont introuvables.");
        return;
    }

    // ==========================================
    // 2. INITIALISATION DU PANIER
    // ==========================================

    let cart = [];

    // ==========================================
    // 3. CRÉATION DE LA FENÊTRE DU PANIER
    // ==========================================

    const cartModal = document.createElement("div");

    cartModal.id = "cartModal";
    cartModal.className = "cart-modal";
    cartModal.setAttribute("aria-hidden", "true");

    cartModal.innerHTML = `
        <div class="cart-overlay"></div>

        <div class="cart-panel"
             role="dialog"
             aria-modal="true"
             aria-labelledby="cartTitle">

            <div class="cart-header">
                <h2 id="cartTitle">Mon panier</h2>

                <button type="button"
                        id="closeCart"
                        aria-label="Fermer le panier">
                    ×
                </button>
            </div>

            <div id="cartItems" class="cart-items">
                <p class="empty-cart">
                    Votre panier est vide.
                </p>
            </div>

            <div class="cart-footer">

                <div class="cart-total">
                    <span>Total</span>
                    <strong id="cartTotal">0 FCFA</strong>
                </div>

                <button type="button"
                        id="checkoutButton"
                        class="gold-button"
                        disabled>
                    VALIDER MA COMMANDE →
                </button>

                <p class="demo-notice">
                    Commande fictive : aucun paiement réel ne sera effectué.
                </p>

            </div>
        </div>
    `;

    document.body.appendChild(cartModal);

    const cartItems = document.getElementById("cartItems");
    const cartTotal = document.getElementById("cartTotal");
    const closeCartButton = document.getElementById("closeCart");
    const checkoutButton = document.getElementById("checkoutButton");

    // ==========================================
    // 4. FONCTIONS UTILITAIRES
    // ==========================================

    // Formater les prix en FCFA
    function formatPrice(price) {
        return new Intl.NumberFormat("fr-FR").format(price) + " FCFA";
    }

    // Ouvrir le panier
    function openCart() {
        cartModal.classList.add("open");
        cartModal.setAttribute("aria-hidden", "false");
        document.body.classList.add("cart-open");
    }

    // Fermer le panier
    function closeCart() {
        cartModal.classList.remove("open");
        cartModal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("cart-open");
    }

    // Afficher un message
    function showMessage(message, type) {
        formMessage.textContent = message;
        formMessage.className = type || "";
    }

    // ==========================================
    // 5. MISE À JOUR DU PANIER
    // ==========================================

    function updateCart() {

        // Calcul de la quantité totale
        const totalQuantity = cart.reduce(
            (total, product) => total + product.quantity,
            0
        );

        // Calcul du prix total affiché
        const totalPrice = cart.reduce(
            (total, product) =>
                total + product.price * product.quantity,
            0
        );

        // Mise à jour du compteur
        cartCount.textContent = totalQuantity;

        // Mise à jour du montant
        cartTotal.textContent = formatPrice(totalPrice);

        // Activation du bouton de commande
        checkoutButton.disabled = cart.length === 0;

        // Si le panier est vide
        if (cart.length === 0) {

            cartItems.innerHTML = `
                <p class="empty-cart">
                    Votre panier est vide.
                </p>
            `;

            return;
        }

        // Affichage des produits
        cartItems.innerHTML = cart.map(product => `

            <article class="cart-item">

                <div class="cart-item-info">
                    <strong>${escapeHTML(product.name)}</strong>
                    <span>${formatPrice(product.price)}</span>
                </div>

                <div class="cart-item-actions">

                    <button type="button"
                            data-action="decrease"
                            data-id="${product.id}">
                        −
                    </button>

                    <span>${product.quantity}</span>

                    <button type="button"
                            data-action="increase"
                            data-id="${product.id}">
                        +
                    </button>

                    <button type="button"
                            class="remove-item"
                            data-action="remove"
                            data-id="${product.id}">
                        Supprimer
                    </button>

                </div>

            </article>

        `).join("");
    }

    // ==========================================
    // 6. PROTECTION DES TEXTES HTML
    // ==========================================

    function escapeHTML(value) {

        return String(value).replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);

    }

    // ==========================================
    // 7. AJOUT DES PRODUITS AU PANIER
    // ==========================================

    productCards.forEach((card, index) => {

        const button = card.querySelector(".product-button");
        const nameElement = card.querySelector("h3");
        const priceElement = card.querySelector(".product-price");

        if (!button || !nameElement || !priceElement) {
            console.warn("Un produit ne possède pas tous ses éléments.");
            return;
        }

        // Récupération du prix affiché
        const price = Number(
            priceElement.textContent.replace(/[^\d]/g, "")
        );

        if (!Number.isFinite(price) || price <= 0) {
            console.warn("Prix invalide :", nameElement.textContent);
            return;
        }

        // Identifiant du produit
        // IMPORTANT : ces identifiants correspondent
        // au catalogue PRODUCTS défini dans server.js.

        const product = {
            id: String(index + 1),
            name: nameElement.textContent.trim(),
            price: price,
            quantity: 1
        };

        // Modification du bouton
        button.textContent = "AJOUTER AU PANIER";

        // Événement de clic
        button.addEventListener("click", () => {

            const existingProduct = cart.find(
                item => item.id === product.id
            );

            if (existingProduct) {

                existingProduct.quantity++;

            } else {

                cart.push({ ...product });

            }

            updateCart();
            openCart();

        });

    });

    // ==========================================
    // 8. MODIFICATION DES QUANTITÉS
    // ==========================================

    cartItems.addEventListener("click", event => {

        const button = event.target.closest("button[data-action]");

        if (!button) {
            return;
        }

        const id = button.dataset.id;
        const action = button.dataset.action;

        const product = cart.find(item => item.id === id);

        if (!product) {
            return;
        }

        // Augmenter la quantité
        if (action === "increase") {

            if (product.quantity < 99) {
                product.quantity++;
            } else {
                alert("La quantité maximale est de 99.");
            }

        }

        // Diminuer la quantité
        if (action === "decrease") {

            product.quantity--;

            if (product.quantity <= 0) {
                cart = cart.filter(item => item.id !== id);
            }

        }

        // Supprimer le produit
        if (action === "remove") {

            cart = cart.filter(item => item.id !== id);

        }

        updateCart();

    });

    // ==========================================
    // 9. OUVERTURE ET FERMETURE DU PANIER
    // ==========================================

    cartButton.addEventListener("click", openCart);

    closeCartButton.addEventListener("click", closeCart);

    // Fermeture avec le fond sombre
    cartModal.querySelector(".cart-overlay")
        .addEventListener("click", closeCart);

    // Fermeture avec la touche Échap
    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {
            closeCart();
        }

    });

    // ==========================================
    // 10. VALIDATION DE LA COMMANDE
    // ==========================================

    checkoutButton.addEventListener("click", () => {

        if (cart.length === 0) {
            return;
        }

        closeCart();

        participationForm.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        showMessage(
            "Votre panier est prêt. Complétez le formulaire de démonstration pour enregistrer votre commande fictive.",
            "success"
        );

    });

    // ==========================================
    // 11. TRAITEMENT DU FORMULAIRE
    // ==========================================

    participationForm.addEventListener("submit", async event => {

        event.preventDefault();

        // --------------------------------------
        // 11.1 RÉCUPÉRATION DES INFORMATIONS
        // --------------------------------------

        const participantName = document
            .getElementById("participantName")
            .value
            .trim();

        const participantCode = document
            .getElementById("participantCode")
            .value
            .trim();

        const testEmail = document
            .getElementById("testEmail")
            .value
            .trim();

        // --------------------------------------
        // 11.2 VALIDATION DU NOM
        // --------------------------------------

        if (
            participantName.length < 2 ||
            participantName.length > 100
        ) {

            showMessage(
                "Veuillez saisir un nom de démonstration valide.",
                "error"
            );

            return;
        }

        // --------------------------------------
        // 11.3 VALIDATION DU CODE PARTICIPANT
        // --------------------------------------

        if (!/^[A-Za-z0-9_-]{1,50}$/.test(participantCode)) {

            showMessage(
                "Veuillez saisir un code participant valide.",
                "error"
            );

            return;
        }

        // --------------------------------------
        // 11.4 VALIDATION DE L'EMAIL
        // --------------------------------------

        if (
            testEmail.length > 150 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)
        ) {

            showMessage(
                "Veuillez saisir une adresse e-mail de test valide.",
                "error"
            );

            return;
        }

        // --------------------------------------
        // 11.5 VÉRIFICATION DU PANIER
        // --------------------------------------

        if (cart.length === 0) {

            showMessage(
                "Veuillez ajouter au moins un parfum à votre panier.",
                "error"
            );

            return;
        }

        // --------------------------------------
        // 11.6 PRÉPARATION DES ARTICLES
        // --------------------------------------

        // On transmet uniquement les identifiants
        // et les quantités.
        //
        // Le serveur retrouvera lui-même les prix
        // depuis son catalogue PRODUCTS.

        const items = cart.map(product => ({
            productId: product.id,
            quantity: product.quantity
        }));

        // --------------------------------------
        // 11.7 PRÉPARATION DE L'ENVOI
        // --------------------------------------

        submitButton.disabled = true;

        showMessage(
            "Enregistrement de votre commande en cours...",
            ""
        );

        try {

            // ==================================
            // ENVOI AU SERVEUR
            // ==================================

            const response = await fetch("/api/events", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    participantName,
                    participantCode,
                    testEmail,

                    // NOUVEAU : ARTICLES DU PANIER
                    items: items

                })

            });

            // Récupération de la réponse
            const result = await response.json();

            // Vérification de la réponse
            if (!response.ok) {

                throw new Error(
                    result.message || "Une erreur est survenue."
                );

            }

            // ==================================
            // 11.8 CONFIRMATION DE LA COMMANDE
            // ==================================

            const commande = result.commande;

            if (!commande) {
                throw new Error(
                    "Le serveur n'a pas retourné les informations de la commande."
                );
            }

            showMessage(
                `Commande n°${commande.id} enregistrée avec succès ! Montant total : ${formatPrice(commande.montantTotal)}. Merci pour votre visite !`,
                "success"
            );

            // ==================================
            // 11.9 VIDER LE PANIER
            // ==================================

            cart = [];

            updateCart();

            // Réinitialiser le formulaire
            participationForm.reset();

        } catch (error) {

            console.error(
                "Erreur lors de l'enregistrement :",
                error
            );

            showMessage(
                error.message ||
                "Impossible de contacter le serveur. Réessayez ultérieurement.",
                "error"
            );

        } finally {

            submitButton.disabled = false;

        }

    });

    // ==========================================
    // 12. AFFICHAGE INITIAL
    // ==========================================

    updateCart();

    console.log("Application Éclat Parfums initialisée.");
    console.log("Gestion du panier activée.");
    console.log("Enregistrement des commandes MySQL prêt.");

});


