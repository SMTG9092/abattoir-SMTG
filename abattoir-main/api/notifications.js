/* ============================================================
   SMTG - NOTIFICATIONS API
   Fichier : api/notifications.js

   🔔 Le bouton Notifications ouvre uniquement
   un petit panneau avec les notifications.

   ❌ Ne redirige PAS vers notifications.html.

   Tables :
   - notifications
   - notification_recipients

   Fonctionnalités :
   - compteur notifications non lues
   - affichage des dernières notifications
   - marquer une notification comme lue
   - tout marquer comme lu
   - actualisation automatique
============================================================ */

(function (window) {

    "use strict";


    /* ============================================================
       CONFIG
    ============================================================ */

    const CONFIG = {

        buttonSelector: "#notificationButton",

        badgeSelector: "#notificationBadge",

        maxNotifications: 10,

        refreshInterval: 60000

    };


    /* ============================================================
       VARIABLES
    ============================================================ */

    let currentUser = null;

    let notifications = [];

    let panel = null;

    let initialized = false;

    let refreshTimer = null;

    let loading = false;


    /* ============================================================
       DATABASE
    ============================================================ */

    function getDB() {

        if (
            window.smtgSupabase &&
            typeof window.smtgSupabase.from === "function"
        ) {

            return window.smtgSupabase;

        }


        if (
            window.supabase &&
            typeof window.supabase.from === "function"
        ) {

            return window.supabase;

        }


        throw new Error(
            "Client Supabase introuvable."
        );

    }


    /* ============================================================
       CURRENT USER
    ============================================================ */

    function getCurrentUser() {

        const keys = [
            "smtg_current_user",
            "smtgUser"
        ];


        for (const key of keys) {

            const raw =
                sessionStorage.getItem(key) ||
                localStorage.getItem(key);


            if (!raw) {
                continue;
            }


            try {

                const user =
                    JSON.parse(raw);


                if (
                    user &&
                    user.id
                ) {

                    return user;

                }

            } catch (error) {

                console.warn(
                    "[SMTGNotifications] Session invalide",
                    error
                );

            }

        }


        return null;

    }


    /* ============================================================
       ESCAPE HTML
    ============================================================ */

    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    /* ============================================================
       DATE
    ============================================================ */

    function formatDate(value) {

        if (!value) {
            return "";
        }


        const date =
            new Date(value);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "";

        }


        const now =
            new Date();


        const diff =
            now.getTime() -
            date.getTime();


        const minute =
            60 * 1000;

        const hour =
            60 * minute;

        const day =
            24 * hour;


        if (
            diff >= 0 &&
            diff < minute
        ) {

            return "À l'instant";

        }


        if (
            diff >= minute &&
            diff < hour
        ) {

            return (
                "Il y a " +
                Math.floor(
                    diff / minute
                ) +
                " min"
            );

        }


        if (
            diff >= hour &&
            diff < day
        ) {

            return (
                "Il y a " +
                Math.floor(
                    diff / hour
                ) +
                " h"
            );

        }


        if (
            diff >= day &&
            diff < 7 * day
        ) {

            return (
                "Il y a " +
                Math.floor(
                    diff / day
                ) +
                " j"
            );

        }


        return date.toLocaleDateString(
            "fr-FR",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }
        );

    }


    /* ============================================================
       ICON
    ============================================================ */

    function getIcon(type) {

        const icons = {

            SUCCESS: "✓",
            WARNING: "!",
            ERROR: "×",
            DANGER: "×",
            ALERT: "!",
            URGENT: "!",
            CRITICAL: "!",
            SECURITY: "⌾",
            MAINTENANCE: "⚙",
            REMINDER: "◷",
            APPROVAL: "✓",
            REJECTION: "×",
            REQUEST: "↗",
            TASK: "✓",
            ASSIGNMENT: "↔",
            MESSAGE: "✉",
            UPDATE: "↻",
            NEW: "★",
            CHANGE: "↻",
            DEADLINE: "◷",
            EXPIRATION: "◷",
            STOCK: "▣",
            QUALITY: "◆",
            PRODUCTION: "⚙",
            EXPEDITION: "▸",
            DELIVERY: "✓",
            PURCHASE: "▤",
            FINANCE: "◆",
            HR: "♙",
            HSE: "◆"

        };


        return (
            icons[
                String(type || "")
                    .toUpperCase()
            ] ||
            "●"
        );

    }


    /* ============================================================
       TYPE CLASS
    ============================================================ */

    function getTypeClass(type) {

        const value =
            String(type || "INFO")
                .toLowerCase()
                .replace(
                    /[^a-z0-9_-]/g,
                    ""
                );


        const allowed = [

            "success",
            "warning",
            "error",
            "danger",
            "alert",
            "urgent",
            "critical",
            "security",
            "maintenance",
            "reminder",
            "approval",
            "rejection",
            "request",
            "task",
            "assignment",
            "message",
            "update",
            "new",
            "change",
            "deadline",
            "expiration",
            "stock",
            "quality",
            "production",
            "expedition",
            "delivery",
            "purchase",
            "finance",
            "hr",
            "hse"

        ];


        return allowed.includes(value)
            ? value
            : "info";

    }


    /* ============================================================
       CSS
    ============================================================ */

    function injectStyles() {

        if (
            document.getElementById(
                "smtgNotificationsStyles"
            )
        ) {

            return;

        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            "smtgNotificationsStyles";


        style.textContent = `

            .smtg-notification-wrapper {

                position: relative;

                display: inline-flex;

                align-items: center;

                justify-content: center;

                z-index: 10000;

            }


            .smtg-notification-panel {

                position: absolute;

                top: calc(100% + 10px);

                right: 0;

                width: 390px;

                max-width:
                    calc(100vw - 24px);

                background: #fff;

                border:
                    1px solid #e3e9e6;

                border-radius: 14px;

                box-shadow:
                    0 18px 50px
                    rgba(15,40,55,.18);

                overflow: hidden;

                opacity: 0;

                visibility: hidden;

                transform:
                    translateY(-6px);

                transition:
                    .18s ease;

            }


            .smtg-notification-panel.show {

                opacity: 1;

                visibility: visible;

                transform:
                    translateY(0);

            }


            .smtg-notification-header {

                display: flex;

                align-items: center;

                justify-content:
                    space-between;

                padding: 14px 16px;

                border-bottom:
                    1px solid #edf1ef;

            }


            .smtg-notification-header-left {

                display: flex;

                align-items: center;

                gap: 9px;

            }


            .smtg-notification-header-icon {

                width: 32px;

                height: 32px;

                display: flex;

                align-items: center;

                justify-content: center;

                border-radius: 9px;

                background: #e9f7ef;

                color: #087a4d;

                font-size: 15px;

            }


            .smtg-notification-header-title {

                color: #173843;

                font-size: 14px;

                font-weight: 800;

            }


            .smtg-notification-header-count {

                margin-top: 2px;

                color: #89979f;

                font-size: 10px;

            }


            .smtg-notification-mark-all {

                border: 0;

                background: transparent;

                color: #087a4d;

                font-size: 10px;

                font-weight: 700;

                cursor: pointer;

            }


            .smtg-notification-mark-all:hover {

                text-decoration: underline;

            }


            .smtg-notification-body {

                max-height: 430px;

                overflow-y: auto;

            }


            .smtg-notification-item {

                position: relative;

                display: flex;

                gap: 10px;

                width: 100%;

                padding: 12px 14px;

                border: 0;

                border-bottom:
                    1px solid #f0f3f4;

                background: #fff;

                text-align: left;

                cursor: pointer;

            }


            .smtg-notification-item:hover {

                background: #f7fbf9;

            }


            .smtg-notification-item.unread {

                background: #f1faf5;

            }


            .smtg-notification-icon {

                width: 34px;

                min-width: 34px;

                height: 34px;

                display: flex;

                align-items: center;

                justify-content: center;

                border-radius: 10px;

                font-size: 13px;

                font-weight: 900;

            }


            .smtg-notification-icon.info {

                background: #edf5fb;

                color: #0874c5;

            }


            .smtg-notification-icon.success {

                background: #eaf8f0;

                color: #07804d;

            }


            .smtg-notification-icon.warning {

                background: #fff6df;

                color: #b77900;

            }


            .smtg-notification-icon.error,

            .smtg-notification-icon.danger,

            .smtg-notification-icon.critical {

                background: #fff0ef;

                color: #d33c32;

            }


            .smtg-notification-icon.security {

                background: #f1ecfb;

                color: #7044b4;

            }


            .smtg-notification-content {

                flex: 1;

                min-width: 0;

            }


            .smtg-notification-title {

                color: #183744;

                font-size: 11px;

                font-weight: 800;

                line-height: 1.35;

            }


            .smtg-notification-item.unread
            .smtg-notification-title::before {

                content: "";

                display: inline-block;

                width: 6px;

                height: 6px;

                margin-right: 6px;

                border-radius: 50%;

                background: #0b8a58;

                vertical-align: middle;

            }


            .smtg-notification-message {

                margin-top: 4px;

                color: #667983;

                font-size: 10px;

                line-height: 1.45;

                display: -webkit-box;

                -webkit-line-clamp: 2;

                -webkit-box-orient: vertical;

                overflow: hidden;

            }


            .smtg-notification-meta {

                display: flex;

                justify-content: space-between;

                gap: 8px;

                margin-top: 6px;

                color: #9aa7ae;

                font-size: 9px;

            }


            .smtg-notification-empty {

                padding: 38px 20px;

                text-align: center;

                color: #92a0a8;

                font-size: 11px;

            }


            .smtg-notification-empty-icon {

                width: 42px;

                height: 42px;

                margin:
                    0 auto 10px;

                display: flex;

                align-items: center;

                justify-content: center;

                border-radius: 50%;

                background: #f1f6f3;

                color: #8ba79a;

                font-size: 18px;

            }


            .smtg-notification-footer {

                padding: 9px 14px;

                border-top:
                    1px solid #edf1f4;

                background: #fafcfb;

                color: #92a0a8;

                font-size: 9px;

                text-align: center;

            }


            @media(max-width:600px) {

                .smtg-notification-panel {

                    position: fixed;

                    top: 62px;

                    right: 12px;

                    width:
                        calc(100vw - 24px);

                }

            }

        `;


        document.head.appendChild(
            style
        );

    }


    /* ============================================================
       CREATE PANEL
    ============================================================ */

    function createPanel() {

        if (panel) {

            return panel;

        }


        const button =
            document.querySelector(
                CONFIG.buttonSelector
            );


        if (!button) {

            console.warn(
                "[SMTGNotifications] #notificationButton introuvable."
            );

            return null;

        }


        let wrapper =
            button.closest(
                ".smtg-notification-wrapper"
            );


        if (!wrapper) {

            wrapper =
                document.createElement(
                    "div"
                );


            wrapper.className =
                "smtg-notification-wrapper";


            button.parentNode.insertBefore(
                wrapper,
                button
            );


            wrapper.appendChild(
                button
            );

        }


        panel =
            document.createElement(
                "div"
            );


        panel.id =
            "smtgNotificationPanel";


        panel.className =
            "smtg-notification-panel";


        panel.innerHTML = `

            <div
                class="smtg-notification-header"
            >

                <div
                    class="smtg-notification-header-left"
                >

                    <div
                        class="smtg-notification-header-icon"
                    >
                        🔔
                    </div>

                    <div>

                        <div
                            class="smtg-notification-header-title"
                        >
                            Notifications
                        </div>

                        <div
                            class="smtg-notification-header-count"
                            id="smtgNotificationHeaderCount"
                        >
                            Chargement...
                        </div>

                    </div>

                </div>


                <button
                    type="button"
                    class="smtg-notification-mark-all"
                    id="smtgNotificationMarkAll"
                >
                    Tout marquer comme lu
                </button>

            </div>


            <div
                class="smtg-notification-body"
                id="smtgNotificationBody"
            >

                <div
                    class="smtg-notification-empty"
                >
                    Chargement...
                </div>

            </div>


            <div
                class="smtg-notification-footer"
            >
                Cliquez sur une notification pour la marquer comme lue.
            </div>

        `;


        wrapper.appendChild(
            panel
        );


        const markAll =
            panel.querySelector(
                "#smtgNotificationMarkAll"
            );


        markAll.addEventListener(
            "click",
            async function(event) {

                event.preventDefault();

                event.stopPropagation();

                await markAllAsRead();

            }
        );


        return panel;

    }


    /* ============================================================
       BADGE
    ============================================================ */

    function updateBadge(
        count
    ) {

        const badge =
            document.querySelector(
                CONFIG.badgeSelector
            );


        if (!badge) {
            return;
        }


        const value =
            Number(count || 0);


        if (
            value <= 0
        ) {

            badge.textContent =
                "";

            badge.classList.remove(
                "show"
            );

            badge.style.display =
                "none";

            return;

        }


        badge.textContent =
            value > 99
                ? "99+"
                : String(value);


        badge.classList.add(
            "show"
        );


        badge.style.display =
            "flex";

    }


    /* ============================================================
       HEADER COUNT
    ============================================================ */

    function updateHeaderCount() {

        if (!panel) {
            return;
        }


        const element =
            panel.querySelector(
                "#smtgNotificationHeaderCount"
            );


        if (!element) {
            return;
        }


        const total =
            notifications.length;


        const unread =
            notifications.filter(
                item =>
                    item.is_read !== true
            ).length;


        if (
            unread > 0
        ) {

            element.textContent =
                unread +
                (
                    unread > 1
                        ? " notifications non lues"
                        : " notification non lue"
                );

        } else {

            element.textContent =
                total +
                (
                    total > 1
                        ? " notifications"
                        : " notification"
                );

        }

    }


    /* ============================================================
       LOAD
    ============================================================ */

    async function load() {

        currentUser =
            getCurrentUser();


        if (
            !currentUser ||
            !currentUser.id
        ) {

            notifications = [];

            updateBadge(0);

            render();

            return [];

        }


        if (loading) {

            return notifications;

        }


        loading = true;


        try {

            const db =
                getDB();


            /*
               DESTINATAIRES
            */

            const {
                data: recipients,
                error: recipientsError
            } = await db

                .from(
                    "notification_recipients"
                )

                .select(
                    "id,notification_id,user_id,is_read,read_at,created_at"
                )

                .eq(
                    "user_id",
                    Number(
                        currentUser.id
                    )
                )

                .order(
                    "created_at",
                    {
                        ascending:false
                    }
                )

                .limit(
                    CONFIG.maxNotifications
                );


            if (
                recipientsError
            ) {

                throw recipientsError;

            }


            if (
                !recipients ||
                recipients.length === 0
            ) {

                notifications = [];

                updateBadge(0);

                render();

                return [];

            }


            const ids =
                recipients.map(
                    row =>
                        Number(
                            row.notification_id
                        )
                );


            /*
               NOTIFICATIONS
            */

            const {
                data: rows,
                error: notificationError
            } = await db

                .from(
                    "notifications"
                )

                .select(`
                    id,
                    title,
                    message,
                    type,
                    sender_id,
                    sender_username,
                    sender_full_name,
                    entity_type,
                    entity_id,
                    link,
                    is_active,
                    created_by,
                    created_at,
                    updated_at
                `)

                .in(
                    "id",
                    ids
                )

                .eq(
                    "is_active",
                    true
                );


            if (
                notificationError
            ) {

                throw notificationError;

            }


            const map =
                new Map(
                    (
                        rows || []
                    ).map(
                        row => [
                            Number(row.id),
                            row
                        ]
                    )
                );


            notifications =
                recipients

                    .map(
                        recipient => {

                            const notification =
                                map.get(
                                    Number(
                                        recipient.notification_id
                                    )
                                );


                            if (!notification) {

                                return null;

                            }


                            return {

                                ...notification,

                                recipient_id:
                                    Number(
                                        recipient.id
                                    ),

                                notification_id:
                                    Number(
                                        recipient.notification_id
                                    ),

                                is_read:
                                    recipient.is_read === true,

                                read_at:
                                    recipient.read_at,

                                recipient_created_at:
                                    recipient.created_at

                            };

                        }
                    )

                    .filter(Boolean);


            notifications.sort(
                (
                    a,
                    b
                ) => {

                    const A =
                        new Date(
                            a.recipient_created_at ||
                            a.created_at ||
                            0
                        ).getTime();


                    const B =
                        new Date(
                            b.recipient_created_at ||
                            b.created_at ||
                            0
                        ).getTime();


                    return B - A;

                }
            );


            const unread =
                notifications.filter(
                    item =>
                        item.is_read !== true
                ).length;


            updateBadge(
                unread
            );


            render();


            return notifications;

        } catch(error) {

            console.error(
                "[SMTGNotifications] Erreur :",
                error
            );


            notifications = [];

            updateBadge(0);

            renderError(
                "Impossible de charger les notifications."
            );


            return [];

        } finally {

            loading = false;

        }

    }


    /* ============================================================
       RENDER
    ============================================================ */

    function render() {

        if (!panel) {
            return;
        }


        const body =
            panel.querySelector(
                "#smtgNotificationBody"
            );


        if (!body) {
            return;
        }


        updateHeaderCount();


        if (
            notifications.length === 0
        ) {

            body.innerHTML = `

                <div
                    class="smtg-notification-empty"
                >

                    <div
                        class="smtg-notification-empty-icon"
                    >
                        ✓
                    </div>

                    Aucune notification

                </div>

            `;

            return;

        }


        body.innerHTML =
            notifications
                .map(
                    renderItem
                )
                .join("");


        body
            .querySelectorAll(
                ".smtg-notification-item"
            )
            .forEach(
                item => {

                    item.addEventListener(
                        "click",
                        async function(event) {

                            event.preventDefault();

                            event.stopPropagation();


                            const id =
                                Number(
                                    this.dataset.recipientId
                                );


                            await markAsRead(
                                id
                            );

                        }
                    );

                }
            );

    }


    /* ============================================================
       RENDER ITEM
    ============================================================ */

    function renderItem(
        notification
    ) {

        const type =
            getTypeClass(
                notification.type
            );


        const icon =
            getIcon(
                notification.type
            );


        const unread =
            notification.is_read !== true;


        const sender =
            notification.sender_full_name ||
            notification.sender_username ||
            "Système";


        return `

            <button
                type="button"
                class="
                    smtg-notification-item
                    ${unread ? "unread" : ""}
                "
                data-recipient-id="${Number(
                    notification.recipient_id
                )}"
            >

                <div
                    class="
                        smtg-notification-icon
                        ${escapeHTML(type)}
                    "
                >
                    ${escapeHTML(icon)}
                </div>


                <div
                    class="smtg-notification-content"
                >

                    <div
                        class="smtg-notification-title"
                    >
                        ${escapeHTML(
                            notification.title ||
                            "Notification"
                        )}
                    </div>


                    <div
                        class="smtg-notification-message"
                    >
                        ${escapeHTML(
                            notification.message ||
                            ""
                        )}
                    </div>


                    <div
                        class="smtg-notification-meta"
                    >

                        <span>
                            ${escapeHTML(
                                sender
                            )}
                        </span>

                        <span>
                            ${escapeHTML(
                                formatDate(
                                    notification.created_at
                                )
                            )}
                        </span>

                    </div>

                </div>

            </button>

        `;

    }


    /* ============================================================
       ERROR
    ============================================================ */

    function renderError(
        message
    ) {

        if (!panel) {
            return;
        }


        const body =
            panel.querySelector(
                "#smtgNotificationBody"
            );


        if (!body) {
            return;
        }


        body.innerHTML = `

            <div
                class="smtg-notification-empty"
            >

                <div
                    class="smtg-notification-empty-icon"
                >
                    !
                </div>

                ${escapeHTML(
                    message
                )}

            </div>

        `;

    }


    /* ============================================================
       MARK ONE AS READ
    ============================================================ */

    async function markAsRead(
        recipientId
    ) {

        const id =
            Number(
                recipientId
            );


        if (!id) {
            return false;
        }


        try {

            const db =
                getDB();


            const {
                error
            } = await db

                .from(
                    "notification_recipients"
                )

                .update({

                    is_read:true,

                    read_at:
                        new Date()
                            .toISOString()

                })

                .eq(
                    "id",
                    id
                )

                .eq(
                    "user_id",
                    Number(
                        currentUser.id
                    )
                );


            if (error) {

                throw error;

            }


            const item =
                notifications.find(
                    notification =>
                        Number(
                            notification.recipient_id
                        ) === id
                );


            if (item) {

                item.is_read = true;

                item.read_at =
                    new Date()
                        .toISOString();

            }


            const unread =
                notifications.filter(
                    notification =>
                        notification.is_read !== true
                ).length;


            updateBadge(
                unread
            );


            render();


            return true;

        } catch(error) {

            console.error(
                "[SMTGNotifications] Erreur markAsRead :",
                error
            );


            return false;

        }

    }


    /* ============================================================
       MARK ALL
    ============================================================ */

    async function markAllAsRead() {

        if (
            !currentUser ||
            !currentUser.id
        ) {

            return false;

        }


        const unread =
            notifications.filter(
                notification =>
                    notification.is_read !== true
            );


        if (
            unread.length === 0
        ) {

            return true;

        }


        try {

            const db =
                getDB();


            const {
                error
            } = await db

                .from(
                    "notification_recipients"
                )

                .update({

                    is_read:true,

                    read_at:
                        new Date()
                            .toISOString()

                })

                .eq(
                    "user_id",
                    Number(
                        currentUser.id
                    )
                )

                .eq(
                    "is_read",
                    false
                );


            if (error) {

                throw error;

            }


            notifications.forEach(
                notification => {

                    notification.is_read =
                        true;

                    notification.read_at =
                        new Date()
                            .toISOString();

                }
            );


            updateBadge(0);

            render();


            return true;

        } catch(error) {

            console.error(
                "[SMTGNotifications] Erreur markAllAsRead :",
                error
            );


            return false;

        }

    }


    /* ============================================================
       UNREAD COUNT
    ============================================================ */

    async function getUnreadCount() {

        currentUser =
            getCurrentUser();


        if (
            !currentUser ||
            !currentUser.id
        ) {

            updateBadge(0);

            return 0;

        }


        try {

            const db =
                getDB();


            const {
                count,
                error
            } = await db

                .from(
                    "notification_recipients"
                )

                .select(
                    "id",
                    {
                        count:"exact",
                        head:true
                    }
                )

                .eq(
                    "user_id",
                    Number(
                        currentUser.id
                    )
                )

                .eq(
                    "is_read",
                    false
                );


            if (error) {

                throw error;

            }


            updateBadge(
                Number(
                    count || 0
                )
            );


            return Number(
                count || 0
            );

        } catch(error) {

            console.error(
                "[SMTGNotifications] Compteur :",
                error
            );


            updateBadge(0);

            return 0;

        }

    }


    /* ============================================================
       OPEN
    ============================================================ */

    async function open() {

        if (!panel) {

            createPanel();

        }


        if (!panel) {
            return;
        }


        panel.classList.add(
            "show"
        );


        await load();

    }


    /* ============================================================
       CLOSE
    ============================================================ */

    function close() {

        if (!panel) {
            return;
        }


        panel.classList.remove(
            "show"
        );

    }


    /* ============================================================
       TOGGLE
    ============================================================ */

    async function toggle() {

        if (!panel) {

            createPanel();

        }


        if (!panel) {
            return;
        }


        if (
            panel.classList.contains(
                "show"
            )
        ) {

            close();

        } else {

            await open();

        }

    }


    /* ============================================================
       OUTSIDE CLICK
    ============================================================ */

    function setupOutsideClick() {

        document.addEventListener(
            "click",
            function(event) {

                if (!panel) {
                    return;
                }


                const wrapper =
                    panel.closest(
                        ".smtg-notification-wrapper"
                    );


                if (
                    wrapper &&
                    !wrapper.contains(
                        event.target
                    )
                ) {

                    close();

                }

            }
        );

    }


    /* ============================================================
       BUTTON
    ============================================================ */

    function setupButton() {

        const button =
            document.querySelector(
                CONFIG.buttonSelector
            );


        if (!button) {

            return;

        }


        /*
           IMPORTANT :
           Le bouton ne doit PAS être
           un lien vers notifications.html.
        */

        button.addEventListener(
            "click",
            async function(event) {

                event.preventDefault();

                event.stopPropagation();

                await toggle();

            }
        );

    }


    /* ============================================================
       AUTO REFRESH
    ============================================================ */

    function startAutoRefresh() {

        if (refreshTimer) {

            clearInterval(
                refreshTimer
            );

        }


        refreshTimer =
            setInterval(
                async function() {

                    if (
                        panel &&
                        panel.classList.contains(
                            "show"
                        )
                    ) {

                        await load();

                    } else {

                        await getUnreadCount();

                    }

                },
                CONFIG.refreshInterval
            );

    }


    /* ============================================================
       INIT
    ============================================================ */

    async function init() {

        if (initialized) {

            return api;

        }


        injectStyles();

        currentUser =
            getCurrentUser();


        createPanel();

        setupButton();

        setupOutsideClick();

        await getUnreadCount();

        await load();

        startAutoRefresh();


        initialized =
            true;


        window.dispatchEvent(
            new CustomEvent(
                "smtg:notifications-ready"
            )
        );


        return api;

    }


    /* ============================================================
       REFRESH
    ============================================================ */

    async function refresh() {

        currentUser =
            getCurrentUser();


        await load();


        return notifications;

    }


    /* ============================================================
       GETTERS
    ============================================================ */

    function getAll() {

        return [
            ...notifications
        ];

    }


    function getUnread() {

        return notifications.filter(
            notification =>
                notification.is_read !== true
        );

    }


    /* ============================================================
       PUBLIC API
    ============================================================ */

    const api = {

        init,

        refresh,

        load,

        open,

        close,

        toggle,

        markAsRead,

        markAllAsRead,

        getUnreadCount,

        getAll,

        getUnread

    };


    /* ============================================================
       GLOBAL
    ============================================================ */

    window.SMTGNotifications =
        api;


    window.Notifications =
        api;


})(window);