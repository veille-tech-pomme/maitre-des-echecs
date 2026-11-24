# Rappels web : ce qui demanderait un serveur (non construit — R4d)

Fait sur l'appareil, sans serveur (R4d) :
- App iOS (Capacitor) : notifications **locales** programmées (7 jours glissants, 1/jour max, heure choisie, annulée si déjà joué).
- Web/PWA : pastille d'icône (Badging API) quand le Coup du jour n'est pas joué, mise à jour à l'ouverture et au retour sur l'app ; fichier `.ics` récurrent (l'agenda du joueur rappelle).

Pourquoi pas de notification sur le web : le navigateur ne sait pas déclencher une notification à une heure donnée app fermée
(Notification Triggers abandonné). La seule voie est le **Web Push** (iOS ≥ 16.4 en PWA installée, Chrome, Firefox),
qui exige un serveur :
1. clés VAPID + point d'envoi (ex. fonction planifiée) qui pousse 1 message/jour à l'heure locale de chaque abonné ;
2. stockage des abonnements (`PushSubscription` : endpoint + clés) → donnée personnelle hébergée : consentement, durée
   de conservation, suppression à la désinscription, **jamais pour les moins de 13 ans** ; RGPD (registre, DPA de l'hébergeur) ;
3. le texte du coach serait calculé sur l'appareil par le service worker à la réception (push « vide » = réveil), pour que
   le serveur ne connaisse ni le niveau ni la progression ;
4. périodicSync (Chromium installé seulement) pourrait mettre à jour la pastille app fermée, sans serveur, mais sans heure garantie.

Décision à prendre par le propriétaire (phase 2, avec le serveur du plan §6) : ce document ne crée rien côté serveur.
