// Lance le bench des joueurs simulés : npx -y tsx tools/bench/reco-bench.mts 200
import { runRecoBench } from './reco-sim';
console.log(JSON.stringify([80, 160, 320].map((np) => runRecoBench(+(process.argv[2] || 60), np)), null, 1));
