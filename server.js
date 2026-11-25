
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const path = require("path");
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// 1. CONNEXION À MYSQL
// =====================================================

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "eclat_parfums_db",
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// =====================================================
// 2. CATALOGUE DES PRODUITS
// =====================================================

// Les prix sont définis côté serveur.
// Le navigateur ne peut donc pas imposer son propre prix.

const PRODUCTS = {
    "1": {
        name: "Miss Dior Eau de Parfum",
        price: 95000
    },
    "2": {
        name: "N°5 Eau de Parfum",
        price: 110000
    },
    "3": {
        name: "Libre Eau de Parfum",
        price: 105000
    },
    "4": {
        name: "Sì Eau de Parfum",
        price: 98000
    }
};

// =====================================================
// 3. CONFIGURATION DE SÉCURITÉ
// =====================================================

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],

                imgSrc: [
                    "'self'",
                    "data:",
                    "https://images.unsplash.com",
                    "https://plus.unsplash.com",
                    "https://images.pexels.com",
                    "https://www.armanibeauty.fr",
                    "https://armanibeauty.fr"
                ],

                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://fonts.googleapis.com"
                ],

                fontSrc: [
                    "'self'",
                    "https://fonts.gstatic.com",
                    "data:"
                ],

                scriptSrc: ["'self'"],

                connectSrc: ["'self'"]
            }
        }
    })
);

// =====================================================
// 4. MIDDLEWARES
// =====================================================

app.use(express.json({ limit: "10kb" }));

app.use(
    express.urlencoded({
        extended: false
    })
);

app.use(express.static(path.join(__dirname, "public")));

// =====================================================
// 5. VÉRIFICATION DU SERVEUR
// =====================================================

app.get("/api/status", (req, res) => {
    res.json({
        message: "Serveur Éclat Parfums opérationnel",
        status: "OK"
    });
});

// =====================================================
// 6. ENREGISTREMENT D'UNE PARTICIPATION ET COMMANDE
// =====================================================

app.post("/api/events", async (req, res) => {

    let connection;
    let transactionStarted = false;

    try {

        const {
            participantName,
            participantCode,
            testEmail,
            items
        } = req.body;

        // -------------------------------------------------
        // 6.1 VALIDATION DU NOM
        // -------------------------------------------------

        if (
            typeof participantName !== "string" ||
            participantName.trim().length < 2 ||
            participantName.trim().length > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Veuillez saisir un nom de démonstration valide."
            });
        }

        // -------------------------------------------------
        // 6.2 VALIDATION DU CODE PARTICIPANT
        // -------------------------------------------------

        if (
            typeof participantCode !== "string" ||
            !/^[A-Za-z0-9_-]{1,50}$/.test(participantCode.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "Veuillez saisir un code participant valide."
            });
        }

        // -------------------------------------------------
        // 6.3 VALIDATION DE L'ADRESSE E-MAIL
        // -------------------------------------------------

        if (
            typeof testEmail !== "string" ||
            testEmail.trim().length > 150 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "Veuillez saisir une adresse e-mail de test valide."
            });
        }

        // -------------------------------------------------
        // 6.4 VALIDATION DES ARTICLES DU PANIER
        // -------------------------------------------------

        if (
            !Array.isArray(items) ||
            items.length === 0 ||
            items.length > 20
        ) {
            return res.status(400).json({
                success: false,
                message: "Votre panier est vide ou contient trop d'articles."
            });
        }

        const validatedItems = [];
        const usedProductIds = new Set();

        let montantTotal = 0;

        for (const item of items) {

            if (
                !item ||
                typeof item.productId !== "string" ||
                !Object.prototype.hasOwnProperty.call(PRODUCTS, item.productId)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Un produit du panier est invalide."
                });
            }

            if (usedProductIds.has(item.productId)) {
                return res.status(400).json({
                    success: false,
                    message: "Un produit est présent plusieurs fois dans le panier."
                });
            }

            usedProductIds.add(item.productId);

            if (
                !Number.isSafeInteger(item.quantity) ||
                item.quantity < 1 ||
                item.quantity > 99
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Une quantité de produit est invalide."
                });
            }

            // Récupération du produit depuis le catalogue serveur
            const product = PRODUCTS[item.productId];

            const sousTotal = product.price * item.quantity;

            montantTotal += sousTotal;

            validatedItems.push({
                productId: item.productId,
                name: product.name,
                price: product.price,
                quantity: item.quantity,
                subtotal: sousTotal
            });
        }

        // Vérification du montant total
        if (!Number.isSafeInteger(montantTotal) || montantTotal <= 0) {
            return res.status(400).json({
                success: false,
                message: "Le montant de la commande est invalide."
            });
        }

        // -------------------------------------------------
        // 6.5 NORMALISATION DES DONNÉES
        // -------------------------------------------------

        const nom = participantName.trim();
        const code = participantCode.trim();
        const email = testEmail.trim().toLowerCase();

        // -------------------------------------------------
        // 6.6 CONNEXION ET DÉMARRAGE DE LA TRANSACTION
        // -------------------------------------------------

        connection = await db.getConnection();

        await connection.beginTransaction();

        transactionStarted = true;

        // -------------------------------------------------
        // 6.7 RECHERCHE DU PARTICIPANT
        // -------------------------------------------------

        const [participants] = await connection.execute(
            `SELECT id, nom_prenom, email
             FROM participants
             WHERE code_participant = ?
             FOR UPDATE`,
            [code]
        );

        let participantId;

        if (participants.length > 0) {

            const participant = participants[0];

            // Vérifier la correspondance des informations
            if (
                participant.nom_prenom.trim().toLowerCase() !== nom.toLowerCase() ||
                participant.email.trim().toLowerCase() !== email
            ) {

                await connection.rollback();
                transactionStarted = false;

                return res.status(409).json({
                    success: false,
                    message: "Ce code participant est déjà associé à un autre profil."
                });
            }

            participantId = participant.id;

        } else {

            // -------------------------------------------------
            // 6.8 ENREGISTREMENT DU NOUVEAU PARTICIPANT
            // -------------------------------------------------

            const [participantResult] = await connection.execute(
                `INSERT INTO participants
                 (nom_prenom, code_participant, email)
                 VALUES (?, ?, ?)`,
                [nom, code, email]
            );

            participantId = participantResult.insertId;
        }

        // -------------------------------------------------
        // 6.9 CRÉATION DE LA COMMANDE
        // -------------------------------------------------

        const [commandeResult] = await connection.execute(
            `INSERT INTO commandes
             (participant_id, montant_total, statut)
             VALUES (?, ?, ?)`,
            [
                participantId,
                montantTotal,
                "ENREGISTREE"
            ]
        );

        const commandeId = commandeResult.insertId;

        // -------------------------------------------------
        // 6.10 ENREGISTREMENT DES DÉTAILS DE LA COMMANDE
        // -------------------------------------------------

        for (const item of validatedItems) {

            await connection.execute(
                `INSERT INTO details_commande
                 (
                    commande_id,
                    produit_id,
                    nom_produit,
                    prix_unitaire,
                    quantite,
                    sous_total
                 )
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    commandeId,
                    item.productId,
                    item.name,
                    item.price,
                    item.quantity,
                    item.subtotal
                ]
            );

        }

        // -------------------------------------------------
        // 6.11 ENREGISTREMENT DE L'ÉVÉNEMENT
        // -------------------------------------------------

        await connection.execute(
            `INSERT INTO simulation_events
             (participant_id, event_type, participant_code)
             VALUES (?, ?, ?)`,
            [
                participantId,
                "order_submission",
                code
            ]
        );

        // -------------------------------------------------
        // 6.12 VALIDATION DE LA TRANSACTION
        // -------------------------------------------------

        await connection.commit();
        transactionStarted = false;

        // -------------------------------------------------
        // 6.13 RÉPONSE AU NAVIGATEUR
        // -------------------------------------------------

        return res.status(201).json({
            success: true,
            message: "Votre commande de démonstration a bien été enregistrée.",

            commande: {
                id: commandeId,
                montantTotal: montantTotal,
                nombreArticles: validatedItems.reduce(
                    (total, item) => total + item.quantity,
                    0
                ),
                statut: "ENREGISTREE",
                produits: validatedItems
            }
        });

    } catch (error) {

        // Annulation de toute la transaction en cas d'erreur
        if (connection && transactionStarted) {

            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    "Erreur lors de l'annulation :",
                    rollbackError.message
                );
            }

        }

        console.error(
            "Erreur lors de l'enregistrement de la commande :",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de l'enregistrement de votre commande."
        });

    } finally {

        if (connection) {
            connection.release();
        }

    }

});

// =====================================================
// 7. GESTION DES ROUTES INEXISTANTES
// =====================================================

app.use((req, res) => {

    res.status(404).json({
        success: false,
        message: "Ressource introuvable."
    });

});

// =====================================================
// 8. DÉMARRAGE DU SERVEUR
// =====================================================

app.listen(PORT, async () => {

    console.log("-----------------------------------");
    console.log("       ÉCLAT PARFUMS");
    console.log("-----------------------------------");

    console.log(`Serveur lancé sur http://localhost:${PORT}`);

    console.log("Images Unsplash autorisées.");
    console.log("Images Armani Beauty autorisées.");
    console.log("API de participation et de commande activée.");

    // Vérification de la connexion MySQL
    try {

        const connection = await db.getConnection();

        console.log("Connexion MySQL réussie.");

        connection.release();

    } catch (error) {

        console.error(
            "Erreur de connexion MySQL :",
            error.message
        );

    }

});
