// Noms français des thèmes de puzzles (Lichess, CC0).
export const THEME_FR: Record<string, string> = {
  fork: 'Fourchette', pin: 'Clouage', skewer: 'Enfilade', discoveredAttack: 'Attaque à la découverte', doubleCheck: 'Échec double', discoveredCheck: 'Échec à la découverte',
  mate: 'Mat', mateIn1: 'Mat en 1', mateIn2: 'Mat en 2', mateIn3: 'Mat en 3', mateIn4: 'Mat en 4', mateIn5: 'Mat en 5+', backRankMate: 'Mat du couloir', smotheredMate: 'Mat à l’étouffée',
  hangingPiece: 'Pièce en prise', deflection: 'Déviation', attraction: 'Attraction', sacrifice: 'Sacrifice', promotion: 'Promotion', underPromotion: 'Sous-promotion', advancedPawn: 'Pion avancé',
  trappedPiece: 'Pièce piégée', intermezzo: 'Coup intermédiaire', clearance: 'Dégagement', interference: 'Interception', xRayAttack: 'Rayons X', capturingDefender: 'Élimination du défenseur',
  zugzwang: 'Zugzwang', quietMove: 'Coup calme', defensiveMove: 'Coup défensif', rookEndgame: 'Finale de tours', pawnEndgame: 'Finale de pions', bishopEndgame: 'Finale de fous', knightEndgame: 'Finale de cavaliers',
  queenEndgame: 'Finale de dames', queenRookEndgame: 'Finale dame et tour', enPassant: 'Prise en passant', castling: 'Roque', kingsideAttack: 'Attaque à l’aile roi', queensideAttack: 'Attaque à l’aile dame', exposedKing: 'Roi exposé',
  attackingF2F7: 'Attaque sur f2/f7', anastasiaMate: 'Mat d’Anastasia', arabianMate: 'Mat arabe', bodenMate: 'Mat de Boden', doubleBishopMate: 'Mat des deux fous', hookMate: 'Mat du crochet', operaMate: 'Mat de l’Opéra',
  pillsburysMate: 'Mat de Pillsbury', epauletteMate: 'Mat des épaulettes', dovetailMate: 'Mat de la queue d’aronde', cornerMate: 'Mat du coin', killBoxMate: 'Mat de la boîte', triangleMate: 'Mat du triangle', morphysMate: 'Mat de Morphy',
  swallowstailMate: 'Mat en queue d’hirondelle', vukovicMate: 'Mat de Vukovic', balestraMate: 'Mat de la balestra', blindSwineMate: 'Mat des cochons aveugles',
  equality: 'Égaliser', crushing: 'Avantage décisif', advantage: 'Avantage', short: 'Court (2 coups)', long: 'Long (3 coups)', veryLong: 'Très long (4+ coups)', oneMove: 'Un seul coup', master: 'Parties de maîtres', masterVsMaster: 'Maître contre maître', superGM: 'Super grands maîtres', opening: 'Ouverture', middlegame: 'Milieu de jeu', endgame: 'Finale', collinearMove: 'Coup colinéaire',
};
export const MAIN_THEMES = ['mateIn1', 'mateIn2', 'mateIn3', 'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'hangingPiece', 'backRankMate', 'smotheredMate', 'deflection', 'attraction', 'sacrifice', 'capturingDefender', 'trappedPiece', 'intermezzo', 'clearance', 'interference', 'xRayAttack', 'quietMove', 'defensiveMove', 'zugzwang', 'promotion', 'advancedPawn', 'pawnEndgame', 'rookEndgame', 'bishopEndgame', 'knightEndgame', 'queenEndgame', 'opening', 'kingsideAttack', 'exposedKing', 'attackingF2F7', 'enPassant', 'underPromotion'];
export const themeName = (t: string) => THEME_FR[t] || t;
