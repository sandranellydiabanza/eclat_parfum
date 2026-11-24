
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
// 2. CONFIGURATION DE SÉCURITÉ
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
// 3. MIDDLEWARES
// =====================================================

app.use(express.json({ limit: "10kb" }));

app.use(
    express.urlencoded({
        extended: false
    })
);

app.use(express.static(path.join(__dirname, "public")));

// =====================================================
// 4. VÉRIFICATION DU SERVEUR
// =====================================================

app.get("/api/status", (req, res) => {
    res.json({
        message: "Serveur Éclat Parfums opérationnel",
        status: "OK"
    });
});

// =====================================================
// 5. ENREGISTREMENT D'UNE PARTICIPATION
// =====================================================

app.post("/api/events", async (req, res) => {

    let connection;

    try {

        const {
            participantName,
            participantCode,
            testEmail
        } = req.body;

        // -------------------------------------------------
        // 5.1 VALIDATION DU NOM
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
        // 5.2 VALIDATION DU CODE PARTICIPANT
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
        // 5.3 VALIDATION DE L'ADRESSE E-MAIL
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

        // Normalisation des données
        const nom = participantName.trim();
        const code = participantCode.trim();
        const email = testEmail.trim().toLowerCase();

        // -------------------------------------------------
        // 5.4 DÉMARRAGE DE LA TRANSACTION
        // -------------------------------------------------

        connection = await db.getConnection();

        await connection.beginTransaction();

        // -------------------------------------------------
        // 5.5 RECHERCHE DU PARTICIPANT
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

            // Le participant existe déjà.
            const participant = participants[0];

            // Vérification de la correspondance des informations.
            if (
                participant.nom_prenom.trim().toLowerCase() !== nom.toLowerCase() ||
                participant.email.trim().toLowerCase() !== email
            ) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "Ce code participant est déjà associé à un autre profil."
                });
            }

            participantId = participant.id;

        } else {

            // -------------------------------------------------
            // 5.6 ENREGISTREMENT DU NOUVEAU PARTICIPANT
            // -------------------------------------------------

            const [result] = await connection.execute(
                `INSERT INTO participants
                 (nom_prenom, code_participant, email)
                 VALUES (?, ?, ?)`,
                [nom, code, email]
            );

            participantId = result.insertId;
        }

        // -------------------------------------------------
        // 5.7 ENREGISTREMENT DE L'ÉVÉNEMENT
        // -------------------------------------------------

        await connection.execute(
            `INSERT INTO simulation_events
             (participant_id, event_type, participant_code)
             VALUES (?, ?, ?)`,
            [
                participantId,
                "form_submission",
                code
            ]
        );

        // -------------------------------------------------
        // 5.8 VALIDATION DE LA TRANSACTION
        // -------------------------------------------------

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Votre participation de démonstration a bien été enregistrée."
        });

    } catch (error) {

        // Annulation en cas d'erreur
        if (connection) {
            await connection.rollback();
        }

        console.error(
            "Erreur lors de l'enregistrement :",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue. Veuillez réessayer."
        });

    } finally {

        if (connection) {
            connection.release();
        }

    }

});

// =====================================================
// 6. GESTION DES ROUTES INEXISTANTES
// =====================================================

app.use((req, res) => {

    res.status(404).json({
        success: false,
        message: "Ressource introuvable."
    });

});

// =====================================================
// 7. DÉMARRAGE DU SERVEUR
// =====================================================

app.listen(PORT, async () => {

    console.log("-----------------------------------");
    console.log("       ÉCLAT PARFUMS");
    console.log("-----------------------------------");

    console.log(`Serveur lancé sur http://localhost:${PORT}`);

    console.log("Images Unsplash autorisées.");
    console.log("Images Armani Beauty autorisées.");
    console.log("API de participation activée.");

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
