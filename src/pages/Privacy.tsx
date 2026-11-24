import { NavBar } from '../components/ui';
export function Privacy() {
  return (
    <div class="page prose">
      <NavBar back="#/profile" backLabel="Moi" />
      <h1>Politique de confidentialité</h1>
      <p class="muted">Dernière mise à jour : 24 novembre 2026 · <em>Modèle à compléter avec l’identité de l’éditeur avant publication.</em></p>
      <h2>En bref</h2>
      <ul><li><b>Aucune publicité</b>, aucun traceur publicitaire, aucune revente de données.</li><li><b>Pas de compte obligatoire.</b> Ta progression (leçons, puzzles, parties) est stockée <b>uniquement sur ton appareil</b>.</li><li>Les analyses Stockfish s’exécutent <b>localement</b> sur ton appareil.</li></ul>
      <h2>Données traitées</h2>
      <ul>
        <li><b>Progression locale</b> : stockée dans le stockage local de l’application ; tu peux l’exporter ou l’effacer depuis Réglages.</li>
        <li><b>Achats (iOS)</b> : gérés par Apple. Notre prestataire RevenueCat reçoit un identifiant anonyme d’achat et l’état de ton abonnement pour débloquer Premium.</li>
        <li><b>Achats (web/Windows)</b> : gérés par Stripe (paiement) ; nous recevons ton e-mail et l’état de l’abonnement.</li>
        <li><b>Journal d’activité local</b> : l’app note sur ton appareil tes ouvertures, séances et cartes du fil, pour te montrer tes propres mesures (Réglages → Mes mesures). Un identifiant d’installation tiré au hasard (jamais dérivé de ton appareil) date ces notes. <b>Rien n’est envoyé.</b></li>
        <li><b>Analyse détaillée (seulement si tu dis oui)</b> : le temps passé sur chaque coup, les pièces que tu hésites à jouer, tes essais dans les puzzles. Ces données restent sur ton appareil ; tu peux les voir, les exporter ou les effacer dans Réglages → Données et coach, et retirer ton accord à tout moment.</li>
        <li><b>Âge</b> : on te demande si tu as 13 ans ou plus. Pour les moins de 13 ans, aucun envoi de données vers un serveur ne sera jamais proposé.</li>
        <li><b>Synchronisation</b> : pas encore disponible. Aucune donnée n’est envoyée à nos serveurs. Si elle arrive, elle te sera demandée séparément.</li>
      </ul>
      <h2>Tes droits (RGPD)</h2>
      <p>Tu disposes d’un droit d’accès, de rectification, d’effacement et de portabilité. Contact : <b>[adresse e-mail de l’éditeur]</b>. Tu peux aussi saisir la CNIL (ou l’APD en Belgique).</p>
      <h2>Enfants</h2>
      <p>L’application s’adresse aux joueurs de 13 ans et plus pour l’analyse détaillée. Elle ne collecte aucune donnée personnelle hors achat, et rien n’est envoyé pour les moins de 13 ans.</p>
      <h2>Éditeur</h2>
      <p>[Nom / société] — [adresse] — [e-mail]</p>
    </div>
  );
}
