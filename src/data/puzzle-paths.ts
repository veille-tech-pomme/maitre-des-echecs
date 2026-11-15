// Parcours de puzzles thématiques : étapes de difficulté croissante (10 puzzles, 7 réussites pour valider).
export interface PathStage { min: number; max: number }
export interface PuzzlePath { id: string; title: string; icon: string; desc: string; themes: string[]; group: string; stages: PathStage[] }
const ST = (from: number, to: number, n = 6): PathStage[] => Array.from({ length: n }, (_, k) => { const a = Math.round(from + ((to - from) * k) / n); const b = Math.round(from + ((to - from) * (k + 1)) / n); return { min: a, max: b + 100 }; });
export const PUZZLE_PATHS: PuzzlePath[] = [
  { id: 'mat1', group: 'Mats', title: 'Mat en 1', icon: '🎯', desc: 'Repère le coup qui mate immédiatement.', themes: ['mateIn1'], stages: ST(400, 1600) },
  { id: 'mat2', group: 'Mats', title: 'Mat en 2', icon: '🎯', desc: 'Un coup préparatoire, puis le mat.', themes: ['mateIn2'], stages: ST(700, 2000) },
  { id: 'mat3', group: 'Mats', title: 'Mat en 3', icon: '🎯', desc: 'Calcule une séquence forcée de trois coups.', themes: ['mateIn3'], stages: ST(1100, 2300) },
  { id: 'mat4', group: 'Mats', title: 'Mat en 4 et plus', icon: '🏹', desc: 'Les longues combinaisons de mat.', themes: ['mateIn4', 'mateIn5'], stages: ST(1400, 2600) },
  { id: 'couloir', group: 'Mats', title: 'Mat du couloir', icon: '🚪', desc: 'Le roi enfermé derrière ses pions.', themes: ['backRankMate'], stages: ST(600, 2000, 5) },
  { id: 'etouffee', group: 'Mats', title: 'Mat à l’étouffée', icon: '🐴', desc: 'Le cavalier mate un roi bloqué par ses propres pièces.', themes: ['smotheredMate'], stages: ST(800, 2100, 4) },
  { id: 'mats-nommes', group: 'Mats', title: 'Mats célèbres', icon: '👑', desc: 'Anastasia, Boden, arabe, Opéra, épaulettes, crochet…', themes: ['anastasiaMate', 'arabianMate', 'bodenMate', 'operaMate', 'epauletteMate', 'hookMate', 'pillsburysMate', 'morphysMate', 'dovetailMate', 'doubleBishopMate', 'cornerMate', 'killBoxMate', 'triangleMate', 'vukovicMate', 'swallowstailMate', 'balestraMate', 'blindSwineMate'], stages: ST(800, 2300) },
  { id: 'fourchette', group: 'Tactiques', title: 'Fourchettes', icon: '🍴', desc: 'Une pièce attaque deux cibles à la fois.', themes: ['fork'], stages: ST(500, 2200) },
  { id: 'clouage', group: 'Tactiques', title: 'Clouages', icon: '📌', desc: 'Immobilise une pièce devant une plus précieuse.', themes: ['pin'], stages: ST(700, 2200) },
  { id: 'enfilade', group: 'Tactiques', title: 'Enfilades', icon: '🍢', desc: 'Attaque la pièce de devant pour gagner celle de derrière.', themes: ['skewer'], stages: ST(800, 2200, 5) },
  { id: 'decouverte', group: 'Tactiques', title: 'Attaques à la découverte', icon: '🎭', desc: 'Une pièce s’écarte et démasque une attaque.', themes: ['discoveredAttack', 'discoveredCheck'], stages: ST(800, 2300) },
  { id: 'double', group: 'Tactiques', title: 'Échecs doubles', icon: '⚡', desc: 'Deux pièces donnent échec en même temps.', themes: ['doubleCheck'], stages: ST(900, 2300, 4) },
  { id: 'deviation', group: 'Tactiques', title: 'Déviation', icon: '↪️', desc: 'Écarte un défenseur de son poste.', themes: ['deflection'], stages: ST(1000, 2400, 5) },
  { id: 'attraction', group: 'Tactiques', title: 'Attraction', icon: '🧲', desc: 'Attire une pièce sur une case fatale.', themes: ['attraction'], stages: ST(1000, 2400, 5) },
  { id: 'sacrifice', group: 'Tactiques', title: 'Sacrifices', icon: '💥', desc: 'Donner du matériel pour gagner plus.', themes: ['sacrifice'], stages: ST(1000, 2500) },
  { id: 'defenseur', group: 'Tactiques', title: 'Élimination du défenseur', icon: '🛡️', desc: 'Capture la pièce qui protège tout.', themes: ['capturingDefender'], stages: ST(900, 2200, 4) },
  { id: 'piegee', group: 'Tactiques', title: 'Pièces piégées', icon: '🪤', desc: 'Une pièce sans case de fuite.', themes: ['trappedPiece'], stages: ST(900, 2200, 4) },
  { id: 'intermediaire', group: 'Tactiques', title: 'Coups intermédiaires', icon: '⏸️', desc: 'Le petit coup qui change tout avant de reprendre.', themes: ['intermezzo'], stages: ST(1200, 2400, 4) },
  { id: 'interception', group: 'Tactiques', title: 'Interception et dégagement', icon: '🧱', desc: 'Couper une ligne ou libérer une case.', themes: ['interference', 'clearance'], stages: ST(1200, 2500, 4) },
  { id: 'rayonsx', group: 'Tactiques', title: 'Rayons X', icon: '🩻', desc: 'Une attaque qui traverse une pièce.', themes: ['xRayAttack'], stages: ST(1200, 2400, 4) },
  { id: 'calme', group: 'Tactiques', title: 'Coups calmes', icon: '🤫', desc: 'Le coup silencieux qui prépare l’imparable.', themes: ['quietMove'], stages: ST(1300, 2600, 5) },
  { id: 'defense', group: 'Tactiques', title: 'Défense', icon: '🧯', desc: 'Trouve le seul coup qui sauve.', themes: ['defensiveMove'], stages: ST(1100, 2500, 5) },
  { id: 'promo', group: 'Finales', title: 'Promotion', icon: '♛', desc: 'Pions avancés et promotions décisives.', themes: ['promotion', 'advancedPawn'], stages: ST(700, 2300) },
  { id: 'f-pions', group: 'Finales', title: 'Finales de pions', icon: '♙', desc: 'Opposition, percées, règle du carré.', themes: ['pawnEndgame'], stages: ST(800, 2400) },
  { id: 'f-tours', group: 'Finales', title: 'Finales de tours', icon: '♜', desc: 'Les finales les plus fréquentes.', themes: ['rookEndgame'], stages: ST(900, 2400) },
  { id: 'f-mineures', group: 'Finales', title: 'Finales de pièces mineures', icon: '♝', desc: 'Fous et cavaliers en finale.', themes: ['bishopEndgame', 'knightEndgame'], stages: ST(1000, 2400, 5) },
  { id: 'f-dames', group: 'Finales', title: 'Finales de dames', icon: '♕', desc: 'Échecs perpétuels et attaques de dame.', themes: ['queenEndgame', 'queenRookEndgame'], stages: ST(1100, 2400, 4) },
  { id: 'zugzwang', group: 'Finales', title: 'Zugzwang', icon: '⛓️', desc: 'Quand l’adversaire est obligé de se nuire.', themes: ['zugzwang'], stages: ST(1200, 2500, 4) },
  { id: 'ouverture', group: 'Phases', title: 'Pièges d’ouverture', icon: '📖', desc: 'Punir les erreurs dès les premiers coups.', themes: ['opening', 'attackingF2F7'], stages: ST(600, 2200) },
  { id: 'roi', group: 'Phases', title: 'Attaque sur le roi', icon: '⚔️', desc: 'Roi exposé, attaque à l’aile roi.', themes: ['kingsideAttack', 'exposedKing'], stages: ST(900, 2400) },
];
export const STAGE_SIZE = 10, STAGE_PASS = 7;
