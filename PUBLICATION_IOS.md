# Publier « Maître des Échecs » sur l’App Store (et en web/Windows)

Ce guide part du projet tel qu’il est livré : la PWA (`dist/`), le projet iOS Capacitor (`ios/`), `codemagic.yaml`, et la couche d’abonnement (`src/lib/entitlements/`). **Pas besoin de Mac** : le build iOS se fait sur Codemagic.

> Identifiants déjà en place : bundle ID **`com.echecs.maitre`**, nom **« Maître des Échecs »** (nom court sur l’écran d’accueil : « Maître Échecs »), produits **`com.echecs.maitre.premium.monthly` / `.annual` / `.lifetime`**, entitlement RevenueCat **`premium`**.

---

## 0. Modèle économique (récapitulatif)

**Zéro publicité, pour toujours.** L’app n’embarque aucun SDK publicitaire ni emplacement de pub (un test automatisé vérifie qu’aucune régie n’apparaît dans les dépendances).

| Gratuit (pour toujours) | Premium |
|---|---|
| Parcours **Débutant → Intermédiaire → Avancé** complet (34 leçons interactives) | Niveau **Expert** (9 leçons) + **parties légendaires commentées** |
| **Puzzles classés illimités** (4 034 puzzles vérifiés) + **puzzle du jour** + **contre-la-montre** (3 min, 5 min, survie) | **Bilans de partie illimités** avec notes du coach **approfondies** |
| **9 bots à personnalité**, tous niveaux, sans limite, mode coach | **Constructeur et entraîneur de répertoire** personnel |
| Échiquier d’**analyse complet** (Stockfish 18, PGN/FEN) | **Statistiques avancées** (précision par phase, répartition des coups, thèmes) |
| **3 bilans de partie complets par jour** (classifications + notes courtes du coach) | Thèmes d’échiquier et jeux de pièces supplémentaires |
| Révisions espacées (SRS), **plan personnalisé**, cours d’ouvertures, finales, badges | Synchronisation cloud (stub prêt à brancher) |

**Prix** : **3,99 €/mois** · **29,99 €/an avec 7 jours gratuits** (≈ 2,50 €/mois, −37 %) · **59,99 € à vie** (achat unique).

### Comparaison avec Chess.com (tarifs publics indicatifs, à revérifier avant publication)
- Chess.com propose des formules **Gold / Platinum / Diamond** (environ 5 à 15 $/mois, ou environ 29 à 100 $/an selon la formule). La version gratuite de Chess.com limite fortement les **bilans de partie** (environ 1 par jour), les **leçons** et les **puzzles**, et affiche de la **publicité**.
- **Maître des Échecs** est **plus généreux en gratuit** : tout le parcours jusqu’au niveau Avancé, des puzzles illimités, tous les bots, l’analyse complète, **3 bilans/jour** et **aucune publicité**, ni en gratuit ni en payant.
- Le Premium à **29,99 €/an** se situe au niveau de l’offre d’entrée de Chess.com, mais inclut le contenu Expert, les bilans illimités avec coach approfondi et le répertoire, c’est-à-dire l’équivalent de leurs formules supérieures.
- L’argument marketing (déjà repris dans le paywall) : **« Progresser est gratuit. Premium, c’est aller plus loin. »**

---

## 1. Compte Apple Developer
1. Crée un Apple ID dédié (avec double authentification), puis inscris-toi sur <https://developer.apple.com/programs/> : **99 €/an**. Choisis « Individuel », ou « Organisation » si tu veux un nom de société comme vendeur (il faut alors un numéro D-U-N-S).
2. Dans **App Store Connect → Accords, taxes et banque**, signe l’accord **« Paid Applications »** et renseigne ton compte bancaire et tes informations fiscales. **Sans cet accord, les abonnements ne fonctionnent pas, même en TestFlight.**
3. *(Conseillé)* Inscris-toi au **App Store Small Business Program** : la commission Apple passe de 30 % à **15 %** sous 1 M$ de revenus par an.
4. Dans **Certificates, IDs & Profiles → Identifiers**, crée l’App ID **`com.echecs.maitre`** avec les capacités **In-App Purchase** et **Push Notifications**. Les notifications locales n’exigent pas cette capacité, mais elle ne gêne pas.
5. Dans **App Store Connect → Apps → +**, crée l’app :
   - Nom : « Maître des Échecs — Apprendre » (30 caractères max).
   - Langue principale : Français.
   - Bundle ID : `com.echecs.maitre`.
   - SKU : `echecs-maitre-001`.

## 2. Abonnements dans App Store Connect
App Store Connect → ton app → **Monétisation → Abonnements** :
1. Crée un **groupe d’abonnements** « Premium » ; ses deux abonnements sont mutuellement exclusifs.
2. Ajoute les deux abonnements auto-renouvelables :

   | Référence | ID produit | Durée | Prix (France/Belgique) |
   |---|---|---|---|
   | Premium mensuel | `com.echecs.maitre.premium.monthly` | 1 mois | 3,99 € |
   | Premium annuel | `com.echecs.maitre.premium.annual` | 1 an | 29,99 € |

   Pour chacun, renseigne le nom affiché et la description en français, ainsi qu’une capture du paywall pour la revue.
3. Classe l’annuel **au-dessus** du mensuel (niveau 1) dans le groupe : changer de formule devient alors un « upgrade » immédiat.
4. Dans **Achats intégrés**, crée l’achat **non consommable** `com.echecs.maitre.premium.lifetime` à **59,99 €**.

### 2bis. Essai gratuit de 7 jours sur l’annuel (offre de lancement)
1. Ouvre l’abonnement **Premium annuel → Prix de l’abonnement → Offres de lancement → +**.
2. Pays : tous. Date de début : aujourd’hui. Pas de date de fin.
3. Type d’offre : **Gratuit**. Durée : **1 semaine**.
4. Apple n’accorde l’offre qu’**une fois par compte et par groupe d’abonnements**. L’app interroge l’éligibilité via RevenueCat ; un utilisateur non éligible voit le prix sans essai.
5. Libellé imposé côté app (déjà en place) : **« 7 jours gratuits, puis 29,99 €/an, annulable à tout moment »**. La feuille de paiement Apple affiche elle aussi la date de première facturation.

### Rappel avant la fin de l’essai (déjà codé)
- Dès qu’un essai est actif (`trialEndsAt` renvoyé par RevenueCat, Stripe ou le mode test), `src/lib/notify.ts` :
  - programme une **notification locale** (`@capacitor/local-notifications`, id 7001) **2 jours avant la fin de l’essai** : « Ton essai Premium se termine dans 2 jours » ;
  - affiche aussi une **bannière dans l’app** (accueil) pendant ces 2 derniers jours, avec un lien « Gérer ».
- La permission de notification n’est demandée qu’au moment où l’essai démarre, jamais au premier lancement.
- Sur le web, seule la bannière in-app est affichée. Côté Stripe, ajoute l’e-mail `customer.subscription.trial_will_end` (voir § 7).

## 3. RevenueCat (StoreKit sans serveur)
1. Crée un compte sur <https://app.revenuecat.com> (gratuit jusqu’à 2 500 $ de revenus mensuels suivis), puis un projet et une app **App Store** avec le bundle ID `com.echecs.maitre`.
2. Branche App Store Connect :
   - **App-Specific Shared Secret** (ASC → ton app → Infos sur l’app) ;
   - **clé API In-App Purchase** (ASC → Utilisateurs et accès → Intégrations → Achats intégrés), pour StoreKit 2.
3. **Products** : importe les 3 produits.
4. **Entitlements** : crée `premium` et attache-lui les 3 produits.
5. **Offerings** : crée l’offering `default` (courante), avec les packages `$rc_monthly`, `$rc_annual` et `$rc_lifetime` mappés sur les produits.
6. Copie la **clé publique iOS** (`appl_…`) et mets-la dans la variable **`VITE_RC_APPLE_KEY`** :
   - dans Codemagic (groupe `echecs_secrets`) ;
   - ou en local dans un fichier `.env.production.local`.

   Elle est lue dans `src/lib/entitlements/config.ts`. Sans clé, l’app reste en mode « démonstration » : le paywall propose d’activer Premium en mode test.
7. *(Optionnel)* Notifications serveur App Store v2 → URL RevenueCat, pour les remboursements et renouvellements en temps réel.
8. Teste avec un **compte Sandbox** (ASC → Utilisateurs et accès → Sandbox). En sandbox, l’essai d’une semaine dure environ 3 minutes.

## 4. Build iOS avec Codemagic (sans Mac)
1. Mets le projet sur un dépôt Git privé (GitHub, GitLab ou Bitbucket) et connecte-le sur <https://codemagic.io> (offre gratuite : 500 minutes macOS par mois).
2. **Team settings → Integrations → App Store Connect** : ajoute une clé API ASC (rôle *App Manager*) nommée **`ASC_KEY`**.
3. **Code signing identities** : laisse Codemagic générer ou récupérer le certificat de distribution et le profil App Store pour `com.echecs.maitre`.
4. **Environment variables** : crée le groupe `echecs_secrets` avec `VITE_RC_APPLE_KEY`.
5. Dans `codemagic.yaml`, remplace `APP_STORE_APPLE_ID` par l’Apple ID numérique de l’app.
6. Pousse un tag `v1.0.0`. Le workflow `ios-release` enchaîne alors :
   1. `npm ci` ;
   2. les tests ;
   3. `npm run build` ;
   4. `npx cap sync ios` ;
   5. la signature ;
   6. la construction de l’IPA ;
   7. l’envoi sur **TestFlight**.
7. Installe TestFlight sur ton iPhone et teste les achats avec le compte Sandbox.
8. Quand tout est validé, passe `submit_to_app_store: true`, ou soumets à la main depuis App Store Connect.

Le projet `ios/` utilise **Swift Package Manager** (Capacitor 8), donc pas de CocoaPods. Les icônes et le splash sont générés depuis `resources/` (`npx capacitor-assets generate --ios`).

## 5. Fiche App Store et confidentialité
- **Catégories** : Jeux → Plateau, et Éducation.
- **Âge** : 4+.
- **Captures** : 6,9" et 6,5" (1320×2868 et 1284×2778). Tu peux partir de `screenshots/iphone-*.png`, à recadrer.
- **Politique de confidentialité** (URL obligatoire) : `public/privacy.html` est fourni et doit être complété avec l’éditeur et le contact. Une fois publiée, l’URL ressemble à `https://<ton-site>/privacy.html`. Elle existe aussi dans l’app (`#/privacy`).
- **Confidentialité de l’app (« étiquette nutritionnelle »)** :
  - « Achats » (historique d’achat, lié à un identifiant anonyme, non utilisé pour le suivi) ;
  - « Identifiants » (identifiant RevenueCat anonyme) ;
  - **aucun suivi** ;
  - aucune donnée de localisation, de contact ou d’usage publicitaire.
- **Chiffrement** : `ITSAppUsesNonExemptEncryption = false` est déjà dans `Info.plist`.
- **Liens obligatoires sur le paywall** (déjà présents) : Conditions d’utilisation (EULA Apple standard), Politique de confidentialité, « Restaurer mes achats ».

## 6. Règle 3.1.1 de l’App Store Review Guidelines
- Tout contenu numérique débloqué dans l’app iOS (Premium) **doit** passer par l’achat intégré Apple. C’est le cas : sur iOS, le fournisseur actif est RevenueCat/StoreKit, et **aucun lien ni bouton vers Stripe n’est affiché dans l’app iOS** (`isNative()` → fournisseur RevenueCat uniquement).
- Les règles sur les liens de paiement externes ont évolué : États-Unis depuis 2025, et UE via le DMA avec des conditions et commissions spécifiques. Par prudence, la v1 n’affiche **aucun** lien externe sur iOS. À réévaluer plus tard.
- Le **bouton « Restaurer mes achats »** est présent (exigence 3.1.1). Le paywall affiche le prix, la durée, l’essai et le renouvellement automatique (exigence 3.1.2).
- Le **mode test « Débloquer Premium »** n’apparaît que s’il n’y a pas de clé de paiement, ou dans Réglages après 5 appuis sur la version. **Vérifie qu’une clé RevenueCat est configurée dans le build soumis**, sinon Apple refusera un paywall de démonstration.
- Règle **4.2 (fonctionnalité minimale)** : l’app est native-like, hors ligne, avec moteur embarqué, sons et retours haptiques. Ce n’est pas un simple site web emballé, ce qui est un point fort pour la revue.

## 7. Paiement web et Windows avec Stripe
La PWA (Windows : Edge ou Chrome → « Installer l’application » ; et tout navigateur) utilise `src/lib/entitlements/stripe.ts`. Deux options :
- **A. Payment Links (le plus simple, sans serveur)** :
  1. Dans le tableau de bord Stripe, crée 3 prix : 3,99 €/mois, 29,99 €/an et 59,99 € en paiement unique.
  2. Sur le lien **annuel**, active l’**essai gratuit de 7 jours**.
  3. Renseigne `VITE_STRIPE_LINK_MONTHLY`, `VITE_STRIPE_LINK_ANNUAL`, `VITE_STRIPE_LINK_LIFETIME` et `VITE_STRIPE_PORTAL_URL` (portail client pour annuler).
  4. Limite : sans serveur, le statut Premium ne peut pas être vérifié de façon fiable entre appareils.
- **B. Checkout + endpoint (recommandé)** :
  1. Déploie `server/stripe-checkout.example.mjs` (Vercel, Netlify ou Cloudflare). Il crée une session Checkout avec **`subscription_data.trial_period_days: 7`** pour l’annuel uniquement.
  2. Renseigne `VITE_STRIPE_CHECKOUT_ENDPOINT` et `VITE_ENTITLEMENT_ENDPOINT` (qui renvoie `{premium, plan, expiresAt, trialEndsAt}`).
  3. Webhooks utiles :
     - `checkout.session.completed` ;
     - `customer.subscription.updated` / `deleted` ;
     - `customer.subscription.trial_will_end` (envoyé par Stripe 3 jours avant la fin de l’essai) → e-mail de rappel.
- **Astuce** : RevenueCat sait aussi suivre les abonnements Stripe (« RevenueCat Web Billing / Stripe »), ce qui unifie le statut Premium iPhone ↔ PC. C’est la base naturelle de la future synchronisation cloud.
- **Moyens de paiement** : activer carte, Apple Pay, Google Pay et Bancontact (Belgique) dans Stripe. La TVA peut être gérée par **Stripe Tax**.

## 8. Licence GPL et App Store (point d’attention)
L’app inclut **Stockfish** et **chessground**, tous deux sous **GPL-3.0** ; l’app entière est donc sous GPL-3.0 (`LICENSE`, `LICENCES.md`).
- La FSF considère que les conditions de l’App Store sont difficilement compatibles avec la GPL (cas VLC en 2011). En pratique, beaucoup d’apps GPL utilisant Stockfish sont publiées sur l’App Store, en **publiant leur code source**.
- **À faire** : publier le code source de chaque version distribuée (dépôt public) et mentionner la licence dans l’app (déjà fait dans Réglages → À propos).
- **Alternative sans risque**, si tu veux un code propriétaire : remplacer chessground par un échiquier maison (MIT) et Stockfish par un moteur sous licence permissive, ou obtenir une licence commerciale. C’est un chantier d’environ 2 à 3 jours pour l’échiquier ; le moteur est plus délicat.
- Les **abonnements restent permis** sous GPL : on vend le service et le contenu (leçons, coach), pas une restriction du code.

## 9. Liste de contrôle avant soumission
- [ ] Accord « Paid Applications » signé, banque et fiscalité renseignées
- [ ] 3 produits créés + offre de lancement 7 jours sur l’annuel
- [ ] RevenueCat : produits, entitlement `premium`, offering `default`, clé `appl_` dans Codemagic
- [ ] `privacy.html` complété et publié ; URL dans App Store Connect
- [ ] Captures 6,9" / 6,5", description, mots-clés (« échecs, apprendre, puzzles, cours, tactique, ouverture »)
- [ ] Build TestFlight testé : achat mensuel, annuel avec essai, à vie, restauration, rappel J-2
- [ ] Code source publié (GPL)
- [ ] Notes pour la revue Apple : « Aucun compte requis. Pour tester Premium, utilisez le compte Sandbox. Toute la progression jusqu’au niveau Avancé est gratuite. »
