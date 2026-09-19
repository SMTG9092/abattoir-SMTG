(function (window) {

    "use strict";

    /*
    =========================================================
    SMTG PERMISSIONS
    Browser version
    Aucun require()
    Aucun module.exports
    =========================================================
    */

    const CONFIG = {

        USER_KEYS: [
            "smtg_current_user",
            "smtgUser"
        ],

        STORAGE_TYPES: [
            "sessionStorage",
            "localStorage"
        ]

    };


    let currentUser = null;

    let permissions = [];

    let permissionsLoaded = false;


    /*
    =========================================================
    GET DATABASE
    =========================================================
    */

    function getDb() {

        if (window.smtgSupabase) {

            return window.smtgSupabase;

        }

        return null;

    }


    /*
    =========================================================
    GET CURRENT USER
    =========================================================
    */

    function getCurrentUser() {

        if (currentUser) {

            return currentUser;

        }


        for (
            const storageType
            of CONFIG.STORAGE_TYPES
        ) {

            let storage;

            try {

                storage =
                    storageType ===
                    "sessionStorage"

                    ? window.sessionStorage

                    : window.localStorage;

            }
            catch (error) {

                continue;

            }


            for (
                const key
                of CONFIG.USER_KEYS
            ) {

                try {

                    const raw =
                        storage.getItem(key);


                    if (!raw) {

                        continue;

                    }


                    const user =
                        JSON.parse(raw);


                    if (
                        user &&
                        user.id
                    ) {

                        currentUser =
                            user;

                        return currentUser;

                    }

                }
                catch (error) {

                    console.warn(
                        "SMTG Permissions : erreur lecture user",
                        error
                    );

                }

            }

        }


        return null;

    }


    /*
    =========================================================
    RESET
    =========================================================
    */

    function reset() {

        currentUser = null;

        permissions = [];

        permissionsLoaded = false;

    }


    /*
    =========================================================
    LOAD PERMISSIONS
    =========================================================
    */

    async function load() {

        const db =
            getDb();


        if (!db) {

            console.error(
                "SMTG Permissions : Supabase client introuvable."
            );

            permissionsLoaded =
                false;

            return false;

        }


        const user =
            getCurrentUser();


        if (!user) {

            console.warn(
                "SMTG Permissions : aucun utilisateur connecté."
            );

            permissions =
                [];

            permissionsLoaded =
                true;

            return true;

        }


        /*
        =====================================================
        1. CHARGER ROLE
        =====================================================
        */

        let roleId =
            user.role_id ||
            null;


        /*
        Si role_id n'est pas dans session,
        on le récupère depuis users.
        */

        if (!roleId) {

            try {

                const {
                    data,
                    error
                } = await db
                    .from("users")
                    .select(
                        "id,role_id,is_active,is_system"
                    )
                    .eq(
                        "id",
                        user.id
                    )
                    .maybeSingle();


                if (!error && data) {

                    roleId =
                        data.role_id;

                }

            }
            catch (error) {

                console.warn(
                    "Impossible de récupérer role_id",
                    error
                );

            }

        }


        /*
        =====================================================
        2. ROLE PAGES
        =====================================================
        */

        let rolePages = [];


        if (roleId) {

            try {

                const {
                    data,
                    error
                } = await db
                    .from("role_pages")
                    .select(
                        `
                        id,
                        role_id,
                        page_id,
                        can_view,
                        can_create,
                        can_edit,
                        can_delete,
                        can_export
                        `
                    )
                    .eq(
                        "role_id",
                        roleId
                    );


                if (error) {

                    console.error(
                        "Erreur role_pages:",
                        error
                    );

                }
                else {

                    rolePages =
                        data ||
                        [];

                }

            }
            catch (error) {

                console.error(
                    "Erreur chargement role_pages:",
                    error
                );

            }

        }


        /*
        =====================================================
        3. USER PAGES
        =====================================================
        */

        let userPages = [];


        try {

            const {
                data,
                error
            } = await db
                .from("user_pages")
                .select(
                    `
                    id,
                    user_id,
                    page_id,
                    can_view,
                    can_create,
                    can_edit,
                    can_delete,
                    can_export
                    `
                )
                .eq(
                    "user_id",
                    user.id
                );


            if (error) {

                console.warn(
                    "Erreur user_pages:",
                    error
                );

            }
            else {

                userPages =
                    data ||
                    [];

            }

        }
        catch (error) {

            console.warn(
                "Erreur chargement user_pages:",
                error
            );

        }


        /*
        =====================================================
        4. PAGES
        =====================================================
        */

        let pages = [];


        try {

            const {
                data,
                error
            } = await db
                .from("pages")
                .select(
                    `
                    id,
                    name,
                    code,
                    path,
                    module,
                    icon,
                    description,
                    sort_order,
                    is_menu,
                    is_active
                    `
                )
                .eq(
                    "is_active",
                    true
                )
                .order(
                    "sort_order",
                    {
                        ascending: true
                    }
                );


            if (error) {

                console.error(
                    "Erreur pages:",
                    error
                );

            }
            else {

                pages =
                    data ||
                    [];

            }

        }
        catch (error) {

            console.error(
                "Erreur chargement pages:",
                error
            );

        }


        /*
        =====================================================
        5. CONSTRUCTION DES PERMISSIONS
        =====================================================
        */

        const roleMap =
            new Map();


        rolePages.forEach(
            function (item) {

                roleMap.set(
                    Number(item.page_id),
                    item
                );

            }
        );


        const userMap =
            new Map();


        userPages.forEach(
            function (item) {

                userMap.set(
                    Number(item.page_id),
                    item
                );

            }
        );


        permissions =
            pages.map(
                function (page) {

                    const pageId =
                        Number(page.id);


                    const rolePermission =
                        roleMap.get(
                            pageId
                        );


                    const userPermission =
                        userMap.get(
                            pageId
                        );


                    /*
                    USER PAGES OVERRIDE ROLE PAGES
                    */

                    const source =
                        userPermission ||
                        rolePermission;


                    return {

                        id:
                            page.id,

                        page_id:
                            page.id,

                        name:
                            page.name,

                        code:
                            page.code,

                        path:
                            page.path,

                        module:
                            page.module,

                        icon:
                            page.icon,

                        sort_order:
                            page.sort_order,

                        is_menu:
                            page.is_menu,

                        can_view:
                            source
                                ? Boolean(
                                    source.can_view
                                )
                                : false,

                        can_create:
                            source
                                ? Boolean(
                                    source.can_create
                                )
                                : false,

                        can_edit:
                            source
                                ? Boolean(
                                    source.can_edit
                                )
                                : false,

                        can_delete:
                            source
                                ? Boolean(
                                    source.can_delete
                                )
                                : false,

                        can_export:
                            source
                                ? Boolean(
                                    source.can_export
                                )
                                : false

                    };

                }
            );


        /*
        =====================================================
        SYSTEM / SUPER ADMIN
        =====================================================
        */

        /*
        IMPORTANT:
        On ne donne pas automatiquement tous les droits
        simplement parce que username = ADMIN.

        Les droits restent contrôlés par role_pages/user_pages.
        */


        permissionsLoaded =
            true;


        return true;

    }


    /*
    =========================================================
    ENSURE LOADED
    =========================================================
    */

    async function ensureLoaded() {

        if (
            permissionsLoaded
        ) {

            return true;

        }


        return await load();

    }


    /*
    =========================================================
    FIND PAGE
    =========================================================
    */

    function findPage(
        pageIdentifier
    ) {

        if (
            pageIdentifier ===
            null ||
            pageIdentifier ===
            undefined
        ) {

            return null;

        }


        const value =
            String(
                pageIdentifier
            )
            .trim();


        if (!value) {

            return null;

        }


        /*
        CODE
        */

        let page =
            permissions.find(
                item =>
                    String(
                        item.code ||
                        ""
                    )
                    .toUpperCase() ===
                    value.toUpperCase()
            );


        if (page) {

            return page;

        }


        /*
        PATH
        */

        page =
            permissions.find(
                item =>
                    String(
                        item.path ||
                        ""
                    )
                    .toLowerCase() ===
                    value.toLowerCase()
            );


        if (page) {

            return page;

        }


        /*
        ID
        */

        const numeric =
            Number(value);


        if (
            Number.isFinite(
                numeric
            )
        ) {

            page =
                permissions.find(
                    item =>
                        Number(
                            item.id
                        ) === numeric
                );

        }


        return page ||
            null;

    }


    /*
    =========================================================
    GET PERMISSION
    =========================================================
    */

    function getPermission(
        pageIdentifier
    ) {

        return findPage(
            pageIdentifier
        );

    }


    /*
    =========================================================
    CAN VIEW
    =========================================================
    */

    function canView(
        pageIdentifier
    ) {

        const page =
            findPage(
                pageIdentifier
            );


        return Boolean(
            page &&
            page.can_view
        );

    }


    /*
    =========================================================
    CAN CREATE
    =========================================================
    */

    function canCreate(
        pageIdentifier
    ) {

        const page =
            findPage(
                pageIdentifier
            );


        return Boolean(
            page &&
            page.can_create
        );

    }


    /*
    =========================================================
    CAN EDIT
    =========================================================
    */

    function canEdit(
        pageIdentifier
    ) {

        const page =
            findPage(
                pageIdentifier
            );


        return Boolean(
            page &&
            page.can_edit
        );

    }


    /*
    =========================================================
    CAN DELETE
    =========================================================
    */

    function canDelete(
        pageIdentifier
    ) {

        const page =
            findPage(
                pageIdentifier
            );


        return Boolean(
            page &&
            page.can_delete
        );

    }


    /*
    =========================================================
    CAN EXPORT
    =========================================================
    */

    function canExport(
        pageIdentifier
    ) {

        const page =
            findPage(
                pageIdentifier
            );


        return Boolean(
            page &&
            page.can_export
        );

    }


    /*
    =========================================================
    REQUIRE PERMISSION
    =========================================================
    */

    async function requirePermission(
        pageIdentifier,
        action = "VIEW"
    ) {

        await ensureLoaded();


        const normalized =
            String(
                action ||
                "VIEW"
            )
            .toUpperCase();


        let allowed =
            false;


        switch (
            normalized
        ) {

            case "VIEW":

                allowed =
                    canView(
                        pageIdentifier
                    );

                break;


            case "CREATE":

                allowed =
                    canCreate(
                        pageIdentifier
                    );

                break;


            case "EDIT":

                allowed =
                    canEdit(
                        pageIdentifier
                    );

                break;


            case "DELETE":

                allowed =
                    canDelete(
                        pageIdentifier
                    );

                break;


            case "EXPORT":

                allowed =
                    canExport(
                        pageIdentifier
                    );

                break;


            default:

                allowed =
                    false;

        }


        if (!allowed) {

            console.warn(
                "Permission refusée:",
                normalized,
                pageIdentifier
            );

        }


        return allowed;

    }


    /*
    =========================================================
    REQUIRE PAGE ACCESS
    =========================================================
    */

    async function requirePageAccess(
        pageIdentifier
    ) {

        const allowed =
            await requirePermission(
                pageIdentifier,
                "VIEW"
            );


        if (!allowed) {

            showAccessDenied();

        }


        return allowed;

    }


    /*
    =========================================================
    CURRENT PAGE
    =========================================================
    */

    function getCurrentPageCode() {

        const path =
            window.location.pathname
                .split("/")
                .pop()
                .toLowerCase();


        const page =
            permissions.find(
                item =>
                    String(
                        item.path ||
                        ""
                    )
                    .split("/")
                    .pop()
                    .toLowerCase() ===
                    path
            );


        return page
            ? page.code
            : null;

    }


    /*
    =========================================================
    REQUIRE CURRENT PAGE
    =========================================================
    */

    async function requireCurrentPageAccess() {

        await ensureLoaded();


        const code =
            getCurrentPageCode();


        if (!code) {

            console.warn(
                "Page actuelle introuvable dans pages:",
                window.location.pathname
            );


            return true;

        }


        return await requirePageAccess(
            code
        );

    }


    /*
    =========================================================
    GUARD BUTTON
    =========================================================
    */

    function guardButton(
        button,
        action,
        pageIdentifier
    ) {

        if (!button) {

            return false;

        }


        const normalized =
            String(
                action ||
                "VIEW"
            )
            .toUpperCase();


        let allowed =
            false;


        switch (
            normalized
        ) {

            case "VIEW":

                allowed =
                    canView(
                        pageIdentifier
                    );

                break;


            case "CREATE":

                allowed =
                    canCreate(
                        pageIdentifier
                    );

                break;


            case "EDIT":

                allowed =
                    canEdit(
                        pageIdentifier
                    );

                break;


            case "DELETE":

                allowed =
                    canDelete(
                        pageIdentifier
                    );

                break;


            case "EXPORT":

                allowed =
                    canExport(
                        pageIdentifier
                    );

                break;

        }


        if (!allowed) {

            button.style.display =
                "none";

        }
        else {

            button.style.display =
                "";

        }


        return allowed;

    }


    /*
    =========================================================
    GUARD BUTTONS
    =========================================================
    */

    function guardButtons(
        selectors,
        action,
        pageIdentifier
    ) {

        const list =
            Array.isArray(
                selectors
            )
            ?
            selectors
            :
            [selectors];


        list.forEach(
            function (selector) {

                document
                    .querySelectorAll(
                        selector
                    )
                    .forEach(
                        function (button) {

                            guardButton(
                                button,
                                action,
                                pageIdentifier
                            );

                        }
                    );

            }
        );

    }


    /*
    =========================================================
    GUARD ACTION
    =========================================================
    */

    async function guardAction(
        action,
        pageIdentifier
    ) {

        return await requirePermission(
            pageIdentifier,
            action
        );

    }


    /*
    =========================================================
    ACCESS DENIED
    =========================================================
    */

    function showAccessDenied() {

        const existing =
            document.getElementById(
                "smtgPermissionDenied"
            );


        if (existing) {

            return;

        }


        const div =
            document.createElement(
                "div"
            );


        div.id =
            "smtgPermissionDenied";


        div.style.cssText = `
            position:fixed;
            inset:0;
            background:#f5f8fc;
            z-index:999999;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:20px;
        `;


        div.innerHTML = `

            <div style="
                max-width:480px;
                width:100%;
                background:#fff;
                border-radius:18px;
                padding:35px;
                text-align:center;
                box-shadow:0 20px 60px rgba(0,0,0,.12);
                border:1px solid #e5ebf3;
            ">

                <div style="
                    width:70px;
                    height:70px;
                    margin:0 auto 18px;
                    border-radius:50%;
                    background:#fff0f1;
                    color:#ef4444;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:28px;
                ">

                    <i class="fa-solid fa-lock"></i>

                </div>


                <h2 style="
                    margin-bottom:10px;
                    color:#172a44;
                ">

                    Accès refusé

                </h2>


                <p style="
                    color:#64748b;
                    line-height:1.6;
                    margin-bottom:22px;
                ">

                    Vous n'avez pas la permission
                    d'accéder à cette page.

                </p>


                <button
                    type="button"
                    onclick="history.back()"
                    style="
                        border:none;
                        background:#2563eb;
                        color:#fff;
                        padding:11px 20px;
                        border-radius:9px;
                        cursor:pointer;
                        font-weight:600;
                    "
                >

                    Retour

                </button>

            </div>

        `;


        document.body.innerHTML =
            "";


        document.body.appendChild(
            div
        );

    }


    /*
    =========================================================
    DEBUG
    =========================================================
    */

    function debug() {

        console.table(
            permissions
        );

        return permissions;

    }


    /*
    =========================================================
    PUBLIC API
    =========================================================
    */

    window.SMTGPermissions = {

        load:
            load,

        reload:
            async function () {

                permissionsLoaded =
                    false;

                return await load();

            },

        reset:
            reset,

        getCurrentUser:
            getCurrentUser,

        getPermission:
            getPermission,

        canView:
            canView,

        canCreate:
            canCreate,

        canEdit:
            canEdit,

        canDelete:
            canDelete,

        canExport:
            canExport,

        requirePermission:
            requirePermission,

        requirePageAccess:
            requirePageAccess,

        requireCurrentPageAccess:
            requireCurrentPageAccess,

        guardButton:
            guardButton,

        guardButtons:
            guardButtons,

        guardAction:
            guardAction,

        debug:
            debug

    };


    /*
    Alias
    */

    window.Permissions =
        window.SMTGPermissions;


})(window);