import { NavBar } from '../components/ui';
export function Privacy() {
  return (
    <div class="page prose">
      <NavBar back="#/profile" backLabel="Moi" />
      <h1>Politique de confidentialité</h1>
      <p class="muted">Dernière mise à jour : 15 novembre 2026 · <em>Modèle à compléter avec l’identité de l’éditeur avant publication.</em></p>
      <h2>En bref</h2>
      <ul><li><b>Aucune publicité</b>, aucun traceur publicitaire, aucune revente de données.</li><li><b>Pas de compte obligatoire.</b> Ta progression (leçons, puzzles, parties) est stockée <b>uniquement sur ton appareil</b>.</li><li>Les analyses Stockfish s’exécutent <b>localement</b> sur ton appareil.</li></ul>
      <h2>Données traitées</h2>
      <ul>
        <li><b>Progression locale</b> : stockée dans le stockage local de l’application ; tu peux l’exporter ou l’effacer depuis Réglages.</li>
        <li><b>Achats (iOS)</b> : gérés par Apple. Notre prestataire RevenueCat reçoit un identifiant anonyme d’achat et l’état de ton abonnement pour débloquer Premium.</li>
        <li><b>Achats (web/Windows)</b> : gérés par Stripe (paiement) ; nous recevons ton e-mail et l’état de l’abonnement.</li>
        <li><b>Synchronisation (Premium, si activée)</b> : copie chiffrée de ta progression sur nos serveurs, supprimable à tout moment.</li>
      </ul>
      <h2>Tes droits (RGPD)</h2>
      <p>Tu disposes d’un droit d’accès, de rectification, d’effacement et de portabilité. Contact : <b>[adresse e-mail de l’éditeur]</b>. Tu peux aussi saisir la CNIL (ou l’APD en Belgique).</p>
      <h2>Enfants</h2>
      <p>L’application convient à tous les âges et ne collecte aucune donnée personnelle sans achat.</p>
      <h2>Éditeur</h2>
      <p>[Nom / société] — [adresse] — [e-mail]</p>
    </div>
  );
}
