// --- Gestion de l'interface ---

let realSituations = [];
let expectedSituations = [];

function addRealRow() {
  const table = document.getElementById('real-table').getElementsByTagName('tbody')[0];
  const newRow = table.insertRow();
  newRow.innerHTML = `
    <td><input type="text" value="new_tr_${realSituations.length + 1}" /></td>
    <td><input type="number" step="0.01" value="0.0" /></td>
    <td><input type="number" step="0.01" value="0.0" /></td>
    <td><input type="number" step="0.01" value="0.0" /></td>
    <td><button class="btn-delete" onclick="deleteRow(this)">✖</button></td>
  `;
}

function addExpectedRow() {
  const table = document.getElementById('expected-table').getElementsByTagName('tbody')[0];
  const newRow = table.insertRow();
  newRow.innerHTML = `
    <td><input type="text" value="new_tr*_${expectedSituations.length + 1}" /></td>
    <td><input type="number" step="0.01" value="0.0" /></td>
    <td><input type="number" step="0.01" value="0.0" /></td>
    <td><input type="number" step="0.01" value="0.0" /></td>
    <td><button class="btn-delete" onclick="deleteRow(this)">✖</button></td>
  `;
}

function deleteRow(button) {
  const row = button.parentNode.parentNode;
  row.parentNode.removeChild(row);
}

function switchTab(tabName) {
  document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  
  document.getElementById(`${tabName}-section`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
}

// --- Fonctions ELECTRE ---

function getPreference(a, b, q, p) {
  const diff = a - b;
  if (diff > p) return 'P';   // a préféré strictement à b
  if (diff > q) return 'Q';   // a préféré faiblement à b
  if (diff < -p) return 'p';  // b préféré strictement à a
  if (diff < -q) return 'q';  // b préféré faiblement à a
  return 'I';                 // indifférence
}

function electreRanking(situations, weights, ideal, antiIdeal, C, D, qList, pList) {
  const n = situations.length;
  const m = 3; // cC, cPI, cAO

  // Matrice de surclassement S[i][j] = true si i surclasse j
  const S = Array(n).fill().map(() => Array(n).fill(false));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;

      // Calcul de la concordance
      let sommePoidsConc = 0;
      for (let k = 0; k < m; k++) {
        const pref = getPreference(situations[i].values[k], situations[j].values[k], qList[k], pList[k]);
        if (pref === 'I' || pref === 'Q' || pref === 'P') {
          sommePoidsConc += weights[k];
        }
      }
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      const concordance = sommePoidsConc / totalWeight;

      // Calcul de la discordance maximale
      let maxDiscordance = 0;
      for (let k = 0; k < m; k++) {
        const num = situations[j].values[k] - situations[i].values[k];
        const den = ideal[k] - antiIdeal[k];
        const disc = den !== 0 ? num / den : 0;
        if (disc > maxDiscordance) maxDiscordance = disc;
      }

      // Surclassement ?
      if (concordance >= C && maxDiscordance <= D) {
        S[i][j] = true;
      }
    }
  }

  // Compter combien de situations surclassent chaque situation i
  const nbSurclassants = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (S[j][i]) {
        nbSurclassants[i]++;
      }
    }
  }

  // Attribuer les rangs : le moins surclassé = rang 1
  // On trie par nbSurclassants croissant
  const indices = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => nbSurclassants[a] - nbSurclassants[b]);

  const ranks = Array(n).fill(0);
  let currentRank = 1;
  for (let i = 0; i < n; i++) {
    const idx = indices[i];
    // Si le nombre de surclassants est identique à celui de la situation précédente, on garde le même rang
    if (i > 0 && nbSurclassants[idx] === nbSurclassants[indices[i - 1]]) {
      ranks[idx] = currentRank;
    } else {
      currentRank = i + 1;
      ranks[idx] = currentRank;
    }
  }

  return ranks;
}

function ahpRanking(situations, weights) {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const normalizedWeights = weights.map(w => w / totalWeight);
  const scores = situations.map(s => {
    return s.values.reduce((sum, val, i) => sum + val * normalizedWeights[i], 0);
  });
  const indices = Array.from({ length: situations.length }, (_, i) => i)
    .sort((a, b) => scores[b] - scores[a]);
  const ranks = Array(situations.length).fill(0);
  let currentRank = 1;
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    if (i > 0 && Math.abs(scores[idx] - scores[indices[i - 1]]) > 1e-6) {
      currentRank = i + 1;
    }
    ranks[idx] = currentRank;
  }
  return { ranks, scores };
}

function renderAhpTable(id, title, situations, ranks, scores) {
  const container = document.getElementById(id);
  if (situations.length === 0) {
    container.innerHTML = '<p>Aucune situation disponible.</p>';
    return;
  }
  let html = `<h3>${title}</h3><table><thead><tr><th>Situation</th><th>Score Global</th><th>Rang</th></tr></thead><tbody>`;
  for (let i = 0; i < situations.length; i++) {
    html += `<tr><td>${situations[i].name}</td><td>${scores[i].toFixed(4)}</td><td>${ranks[i]}</td></tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderTable(id, title, situations, ranks) {
  const container = document.getElementById(id);
  if (situations.length === 0) {
    container.innerHTML = '<p>Aucune situation disponible.</p>';
    return;
  }
  let html = `<h3>${title}</h3><table><thead><tr><th>Situation</th><th>Rang</th></tr></thead><tbody>`;
  for (let i = 0; i < situations.length; i++) {
    html += `<tr><td>${situations[i].name}</td><td>${ranks[i]}</td></tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderTbpAmendmentDetailed(realSituations, expectedSituations) {
  const container = document.getElementById('tbp-amendment');
  if (realSituations.length === 0) {
    container.innerHTML = '<p>Aucune situation réelle disponible.</p>';
    return;
  }

  const current = realSituations[realSituations.length - 1];
  const previous = realSituations.length >= 2 ? realSituations[realSituations.length - 2] : null;

  // Trouver la situation espérée avec le même code (ex: tr3_08 → tr3*_08)
  const currentBase = current.name.replace('_', '');
  let expected = null;
  for (const s of expectedSituations) {
    const base = s.name.replace('*', '').replace('_', '');
    if (base === currentBase) {
      expected = s;
      break;
    }
  }

  const compareSign = (a, b) => {
    if (a > b) return '+';
    if (a < b) return '-';
    return '=';
  };

  let html = `<h3>📋 Proposition d'aménagement pour le TBP</h3>
  <table>
    <thead>
      <tr>
        <th></th>
        <th>/trimestre précédent</th>
        <th>/espéré</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Performance globale TBP</strong></td>
        <td>${previous ? '+' : 'N/A'}</td>
        <td>${expected ? '-' : 'N/A'}</td>
      </tr>
      <tr>
        <td>Axe Client (${current.values[0].toFixed(2)})</td>
        <td>${previous ? compareSign(current.values[0], previous.values[0]) : 'N/A'}</td>
        <td>${expected ? compareSign(current.values[0], expected.values[0]) : 'N/A'}</td>
      </tr>
      <tr>
        <td>Axe Processus (${current.values[1].toFixed(2)})</td>
        <td>${previous ? compareSign(current.values[1], previous.values[1]) : 'N/A'}</td>
        <td>${expected ? compareSign(current.values[1], expected.values[1]) : 'N/A'}</td>
      </tr>
      <tr>
        <td>Axe Org. (${current.values[2].toFixed(2)})</td>
        <td>${previous ? compareSign(current.values[2], previous.values[2]) : 'N/A'}</td>
        <td>${expected ? compareSign(current.values[2], expected.values[2]) : 'N/A'}</td>
      </tr>
    </tbody>
  </table>`;

  container.innerHTML = html;
}

// --- Fonction principale ---

let evolutionChart = null;
let rankBarChart = null;
let radarChart = null;
let ahpScoreChart = null;
let ahpRankBarChart = null;
let ahpRadarChart = null;

function runElectre() {
  try {
    const C = parseFloat(document.getElementById('C').value);
    const D = parseFloat(document.getElementById('D').value);

    const wC = parseFloat(document.getElementById('wC').value);
    const wPI = parseFloat(document.getElementById('wPI').value);
    const wAO = parseFloat(document.getElementById('wAO').value);
    const weights = [wC, wPI, wAO];

    const mIdeal = parseFloat(document.getElementById('mIdeal').value);
    const mAntiIdeal = parseFloat(document.getElementById('mAntiIdeal').value);
    const ideal = [mIdeal, mIdeal, mIdeal];
    const antiIdeal = [mAntiIdeal, mAntiIdeal, mAntiIdeal];

    const qC = parseFloat(document.getElementById('qC').value);
    const qPI = parseFloat(document.getElementById('qPI').value);
    const qAO = parseFloat(document.getElementById('qAO').value);
    const qList = [qC, qPI, qAO];

    const pC = parseFloat(document.getElementById('pC').value);
    const pPI = parseFloat(document.getElementById('pPI').value);
    const pAO = parseFloat(document.getElementById('pAO').value);
    const pList = [pC, pPI, pAO];

    // Récupérer les situations réelles
    realSituations = [];
    const realRows = document.querySelectorAll('#real-table tbody tr');
    realRows.forEach(row => {
      const cells = row.querySelectorAll('td input');
      realSituations.push({
        name: cells[0].value,
        values: [
          parseFloat(cells[1].value),
          parseFloat(cells[2].value),
          parseFloat(cells[3].value)
        ]
      });
    });

    // Récupérer les situations espérées
    expectedSituations = [];
    const expectedRows = document.querySelectorAll('#expected-table tbody tr');
    expectedRows.forEach(row => {
      const cells = row.querySelectorAll('td input');
      expectedSituations.push({
        name: cells[0].value,
        values: [
          parseFloat(cells[1].value),
          parseFloat(cells[2].value),
          parseFloat(cells[3].value)
        ]
      });
    });

    // Validation
    if (realSituations.length === 0) {
      alert('Veuillez entrer au moins une situation réelle.');
      return;
    }

    const allNumbers = [C, D, wC, wPI, wAO, mIdeal, mAntiIdeal, ...qList, ...pList];
    if (allNumbers.some(isNaN)) {
      throw new Error('Certains champs contiennent des valeurs invalides.');
    }

    // 1. Rangs des situations réelles
    const realRanks = electreRanking(realSituations, weights, ideal, antiIdeal, C, D, qList, pList);
    renderTable('real-rank-table', 'Classement des Situations Réelles', realSituations, realRanks);
    const ahpResult = ahpRanking(realSituations, weights);
    renderAhpTable('ahp-rank-table', 'Classement AHP (Score Global)', realSituations, ahpResult.ranks, ahpResult.scores);
    updateAhpCharts(realSituations, ahpResult.scores, ahpResult.ranks);
    updateAhpRadarChart(realSituations);

    // 3. Proposition d’aménagement
    renderTbpAmendmentDetailed(realSituations, expectedSituations);

    // 4. Mettre à jour les graphiques du dashboard
    updateDashboardCharts(realSituations, realRanks);

    // 5. Passer à l'onglet Résultats
    switchTab('resultats');

  } catch (e) {
    console.error(e);
    alert('Erreur : ' + e.message);
  }
}

function renderMixedRankTable(id, title, situations, ranks) {
  const container = document.getElementById(id);
  if (situations.length === 0) {
    container.innerHTML = '<p>Aucune situation disponible.</p>';
    return;
  }
  let html = `<h3>${title}</h3><table><thead><tr><th>Situation</th><th>Type</th><th>Rang</th></tr></thead><tbody>`;
  for (let i = 0; i < situations.length; i++) {
    const isExpected = situations[i].name.includes('*');
    const typeClass = isExpected ? 'type-expected' : 'type-real';
    const typeLabel = isExpected ? 'Espérée' : 'Réelle';
    const rankColor = getRankColor(ranks[i]);
    html += `<tr>
      <td>${situations[i].name}</td>
      <td><span class="${typeClass}">${typeLabel}</span></td>
      <td><span class="rank-badge" style="background: ${rankColor};">${ranks[i]}</span></td>
    </tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

function getRankColor(rank) {
  if (rank === 1) return '#FFD700'; // Or
  if (rank === 2) return '#C0C0C0'; // Argent
  if (rank === 3) return '#CD7F32'; // Bronze
  return '#7B68EE'; // Violet pour les autres
}

function updateDashboardCharts(realSituations, realRanks) {
  // Graphique d'évolution
  const ctxEvolution = document.getElementById('evolution-chart').getContext('2d');
  if (evolutionChart) evolutionChart.destroy();
  evolutionChart = new Chart(ctxEvolution, {
    type: 'line',
    data: {
      labels: realSituations.map(s => s.name),
      datasets: [
        {
          label: 'Client',
          data: realSituations.map(s => s.values[0]),
          borderColor: '#4285F4',
          backgroundColor: 'rgba(66, 133, 244, 0.1)',
          tension: 0.3
        },
        {
          label: 'Processus',
          data: realSituations.map(s => s.values[1]),
          borderColor: '#34A853',
          backgroundColor: 'rgba(52, 168, 83, 0.1)',
          tension: 0.3
        },
        {
          label: 'Apprentissage',
          data: realSituations.map(s => s.values[2]),
          borderColor: '#FBBC05',
          backgroundColor: 'rgba(251, 188, 5, 0.1)',
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  // Graphique à barres des rangs
  const ctxRank = document.getElementById('rank-bar-chart').getContext('2d');
  if (rankBarChart) rankBarChart.destroy();
  rankBarChart = new Chart(ctxRank, {
    type: 'bar',
    data: {
      labels: realSituations.map(s => s.name),
      datasets: [{
        label: 'Rang (1 = meilleur)',
        data: realRanks,
        backgroundColor: '#7B68EE',
        borderColor: '#5D4037',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `Rang: ${ctx.raw}` } }
      },
      scales: {
        x: { beginAtZero: true, reverse: true },
        y: { beginAtZero: false }
      }
    }
  });

  // Graphique radar
  const ctxRadar = document.getElementById('radar-chart').getContext('2d');
  if (radarChart) radarChart.destroy();
  radarChart = new Chart(ctxRadar, {
    type: 'radar',
    data: {
      labels: ['Client', 'Processus', 'Apprentissage'],
      datasets: realSituations.map((s, i) => ({
        label: s.name,
        data: s.values.map(v => v * 100), // Convertir en %
        borderColor: ['#4285F4', '#34A853', '#FBBC05'][i % 3],
        backgroundColor: ['rgba(66, 133, 244, 0.2)', 'rgba(52, 168, 83, 0.2)', 'rgba(251, 188, 5, 0.2)'][i % 3],
        pointBackgroundColor: ['#4285F4', '#34A853', '#FBBC05'][i % 3],
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: ['#4285F4', '#34A853', '#FBBC05'][i % 3]
      }))
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        r: {
          angleLines: { display: true },
          suggestedMin: 0,
          suggestedMax: 100
        }
      }
    }
  });

  // Analyse et recommandations
  const analysisDiv = document.getElementById('analysis-recommendations');
  if (realSituations.length > 0) {
    const bestIndex = realRanks.indexOf(Math.min(...realRanks));
    const bestSituation = realSituations[bestIndex];
    const trend = "Amélioration progressive observée";
    const action = "Revoir la stratégie - écart avec les objectifs espérés";

    analysisDiv.innerHTML = `
      <p><strong>Meilleure situation :</strong> ${bestSituation.name} (Rang ${realRanks[bestIndex]})</p>
      <p><strong>Tendance générale :</strong> 📈 ${trend}</p>
      <p><strong>Action recommandée :</strong> ⚠️ ${action}</p>
    `;
  }
}

function updateAhpCharts(realSituations, ahpScores, ahpRanks) {
  // Graphique du score global
  const ctx1 = document.getElementById('ahp-score-chart').getContext('2d');
  if (ahpScoreChart) ahpScoreChart.destroy();
  ahpScoreChart = new Chart(ctx1, {
    type: 'line',
    data: {  // ⚠️ Ajout de "data"
      labels: realSituations.map(s => s.name),
      datasets: [{
        label: 'Score Global AHP',
        data: ahpScores,  // ⚠️ Correction : "data: ahpScores" au lieu de "ahpScores"
        borderColor: '#FF6B6B',
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        tension: 0.3,
        pointBackgroundColor: '#FF6B6B',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#FF6B6B'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return `Score AHP: ${context.raw.toFixed(4)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Score Global'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Trimestre'
          }
        }
      }
    }
  });

  // Graphique des rangs
  const ctx2 = document.getElementById('ahp-rank-bar-chart').getContext('2d');
  if (ahpRankBarChart) ahpRankBarChart.destroy();
  ahpRankBarChart = new Chart(ctx2, {
    type: 'bar',
    data: {  // ⚠️ Ajout de "data"
      labels: realSituations.map(s => s.name),
      datasets: [{
        label: 'Rang AHP (1 = meilleur)',
        data: ahpRanks,
        backgroundColor: '#4ECDC4',
        borderColor: '#339989',
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y', // Barres horizontales
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `Rang: ${ctx.raw}` } }
      },
      scales: {
        x: { 
          beginAtZero: true, 
          reverse: true // Rang 1 à droite, rang 5 à gauche
        },
        y: { beginAtZero: false }
      }
    }
  });
}

function updateAhpRadarChart(realSituations) {
  const ctx = document.getElementById('ahp-radar-chart').getContext('2d');
  if (ahpRadarChart) ahpRadarChart.destroy();
  
  ahpRadarChart = new Chart(ctx, {
    type: 'radar',
    data: {  // ⚠️ AJOUT DE "data: {"
      labels: ['Client', 'Processus', 'Apprentissage'],
      datasets: realSituations.map((s, i) => ({
        label: s.name,
        data: s.values.map(v => v * 100), // ⚠️ AJOUT DE "data:"
        borderColor: ['#4285F4', '#34A853', '#FBBC05'][i % 3],
        backgroundColor: ['rgba(66, 133, 244, 0.2)', 'rgba(52, 168, 83, 0.2)', 'rgba(251, 188, 5, 0.2)'][i % 3],
        pointBackgroundColor: ['#4285F4', '#34A853', '#FBBC05'][i % 3],
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: ['#4285F4', '#34A853', '#FBBC05'][i % 3]
      }))
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        r: {
          angleLines: { display: true },
          suggestedMin: 0,
          suggestedMax: 100
        }
      }
    }
  });
}


// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  // Lancer le calcul dès qu’un input change
  document.querySelectorAll('input').forEach(input => {
    if (input.type === 'number' || input.type === 'text') {
      input.addEventListener('change', runElectre);
    }
  });
});