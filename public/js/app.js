
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

    function formatPrice(price) {
        return new Intl.NumberFormat("fr-FR").format(price) + " FCFA";
    }

    function openCart() {
        cartModal.classList.add("open");
        cartModal.setAttribute("aria-hidden", "false");
        document.body.classList.add("cart-open");
    }

    function closeCart() {
        cartModal.classList.remove("open");
        cartModal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("cart-open");
    }

    function showMessage(message, type) {
        formMessage.textContent = message;
        formMessage.className = type || "";
    }

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
    // 5. MISE À JOUR DU PANIER
    // ==========================================

    function updateCart() {

        const totalQuantity = cart.reduce(
            (total, product) => total + product.quantity,
            0
        );

        const totalPrice = cart.reduce(
            (total, product) =>
                total + product.price * product.quantity,
            0
        );

        cartCount.textContent = totalQuantity;
        cartTotal.textContent = formatPrice(totalPrice);

        checkoutButton.disabled = cart.length === 0;

        if (cart.length === 0) {
            cartItems.innerHTML = `
                <p class="empty-cart">
                    Votre panier est vide.
                </p>
            `;
            return;
        }

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
    // 6. AJOUT DES PRODUITS AU PANIER
    // ==========================================

    productCards.forEach((card, index) => {

        const button = card.querySelector(".product-button");
        const nameElement = card.querySelector("h3");
        const priceElement = card.querySelector(".product-price");

        if (!button || !nameElement || !priceElement) {
            console.warn("Un produit ne possède pas tous ses éléments.");
            return;
        }

        const price = Number(
            priceElement.textContent.replace(/[^\d]/g, "")
        );

        if (!Number.isFinite(price) || price <= 0) {
            console.warn("Prix invalide :", nameElement.textContent);
            return;
        }

        const product = {
            id: String(index + 1),
            name: nameElement.textContent.trim(),
            price: price,
            quantity: 1
        };

        button.textContent = "AJOUTER AU PANIER";

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
    // 7. MODIFICATION DES QUANTITÉS
    // ==========================================

    cartItems.addEventListener("click", event => {

        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const id = button.dataset.id;
        const action = button.dataset.action;

        const product = cart.find(item => item.id === id);

        if (!product) return;

        if (action === "increase") {
            if (product.quantity < 99) {
                product.quantity++;
            } else {
                alert("La quantité maximale est de 99.");
            }
        }

        if (action === "decrease") {
            product.quantity--;

            if (product.quantity <= 0) {
                cart = cart.filter(item => item.id !== id);
            }
        }

        if (action === "remove") {
            cart = cart.filter(item => item.id !== id);
        }

        updateCart();
    });

    // ==========================================
    // 8. OUVERTURE ET FERMETURE DU PANIER
    // ==========================================

    cartButton.addEventListener("click", openCart);
    closeCartButton.addEventListener("click", closeCart);

    cartModal.querySelector(".cart-overlay")
        .addEventListener("click", closeCart);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeCart();
        }
    });

    // ==========================================
    // 9. VALIDATION DE LA COMMANDE
    // ==========================================

    checkoutButton.addEventListener("click", () => {

        if (cart.length === 0) return;

        closeCart();

        participationForm.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        showMessage(
            "Votre panier est prêt. Complétez le formulaire pour enregistrer votre commande fictive.",
            "success"
        );
    });

    // ==========================================
    // 10. TRAITEMENT DU FORMULAIRE
    // ==========================================

    participationForm.addEventListener("submit", async event => {

        event.preventDefault();

        const participantName = document
            .getElementById("participantName")
            .value.trim();

        const participantCode = document
            .getElementById("participantCode")
            .value.trim();

        const testEmail = document
            .getElementById("testEmail")
            .value.trim();

        // Validation du nom
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

        // Validation du code de test
        if (!/^[A-Za-z0-9_-]{1,50}$/.test(participantCode)) {
            showMessage(
                "Veuillez saisir un code de test valide.",
                "error"
            );
            return;
        }

        // Validation de l'adresse e-mail
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

        // Vérification du panier
        if (cart.length === 0) {
            showMessage(
                "Veuillez ajouter au moins un parfum à votre panier.",
                "error"
            );
            return;
        }

        // Préparation des articles
        const items = cart.map(product => ({
            productId: product.id,
            quantity: product.quantity
        }));

        submitButton.disabled = true;

        showMessage(
            "Enregistrement de votre commande fictive en cours...",
            ""
        );

        try {

            const response = await fetch("/api/events", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    participantName,
                    participantCode,
                    testEmail,
                    items
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Une erreur est survenue."
                );
            }

            const commande = result.commande;

            if (!commande) {
                throw new Error(
                    "Le serveur n'a pas retourné les informations de la commande."
                );
            }

            // Confirmation de la commande fictive
            showMessage(
                `Commande fictive n°${commande.id} enregistrée avec succès ! Merci pour votre visite.`,
                "success"
            );

            // Réinitialisation du panier
            cart = [];
            updateCart();

            // Réinitialisation du formulaire
            participationForm.reset();

            // Redirection vers la véritable boutique de parfums
            setTimeout(() => {
                window.location.assign("https://fragrancepassion.fr/");
            }, 2500);

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
    // 11. AFFICHAGE INITIAL
    // ==========================================

    updateCart();

    console.log("Application Éclat Parfums initialisée.");
    console.log("Gestion du panier activée.");
    console.log("Enregistrement des commandes fictives prêt.");

});
