'use strict';

const Status = {
  TO_DO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
}
const Default = {
  VELOCITY: 40,
  PTS: 40,
  HARDENING: 0,
}

let VELOCITY = 40;
let PTS = 40;
let HARDENING = 0;

const FEAT = 'FEAT';

const BASE_URL = 'https://phillydev.atlassian.net/browse/';

const handleVelocity = e => {
  VELOCITY = parseInt(e.value, 10);
  localStorage.setItem('VELOCITY', VELOCITY);
  fetchData();
}

const handlePts = e => {
  PTS = parseInt(e.value, 10);
  localStorage.setItem('PTS', PTS);

  fetchData();
}

const handleHardening = e => {
  HARDENING = parseInt(e.value, 10);
  localStorage.setItem('HARDENING', HARDENING);
  fetchData();
}

const setDefault = e => {
  e.preventDefault();
  VELOCITY = Default.VELOCITY;
  PTS = Default.PTS;
  HARDENING = Default.HARDENING;
  document.getElementById('js-velocity').value = VELOCITY;
  document.getElementById('js-pts').value = PTS;
  document.getElementById('js-hardening').value = HARDENING;
  localStorage.setItem('VELOCITY', VELOCITY);
  localStorage.setItem('PTS', PTS);
  localStorage.setItem('HARDENING', HARDENING);
  fetchData();
}

const checkLocalStorage = () => {
  const velocityLocal = localStorage.getItem('VELOCITY');
  if (velocityLocal) VELOCITY = parseInt(velocityLocal, 10);
  const ptsLocal = localStorage.getItem('PTS');
  if (ptsLocal) PTS = parseInt(ptsLocal, 10);
  const hardeningLocal = localStorage.getItem('HARDENING');
  if (hardeningLocal) HARDENING = parseInt(hardeningLocal, 10);

  document.getElementById('js-velocity').value = VELOCITY;
  document.getElementById('js-pts').value = PTS;
  document.getElementById('js-hardening').value = HARDENING;

}

const readFile = async seq => {
  const response = await fetch(`data${seq}.json`);
  if (!response.ok) return;
  return await response.json();
}

const parseData = raw => {
  if (!raw.issues) return null;

  return raw.issues.map(issue => {
    // console.log(issue);
    const {
      key,
      fields: {
        issuetype,
        summary: title,
        labels,
        customfield_10016 : point,
        status,
        parent,
      }
    } = issue;

    return {key, type: issuetype?.name, title, labels, point, status: status?.name, parent: parent?.key};
  });

}

const renderSummary = list => {
  let completedPts = 0;
  let totalPts = 0;

  list.forEach(issue => {
    completedPts += issue.donePoint;
    totalPts += issue.updatedTotalPoint;
  });

  const progress = parseInt(completedPts / totalPts * 1000, 10) / 10;
  const remainingPts = totalPts - completedPts;

  const remainingDays = remainingPts / VELOCITY * 14 + HARDENING * 7;

  const eta = new Date();
  eta.setDate(new Date().getDate() + remainingDays);
  const daysUntilNextWed = (3 - eta.getDay() + 7) % 7;  
  eta.setDate(eta.getDate() + daysUntilNextWed);

  const etaDate = eta.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  document.getElementById('js-eta').innerHTML = `"${etaDate}"`;
  document.getElementById('js-progress').innerHTML = `<span class='font_lm red'>${progress}%</span> (${completedPts}/${totalPts} pts)`;

  
  if (Default.VELOCITY === VELOCITY && Default.PTS === PTS && Default.HARDENING === HARDENING) {
    console.log("here")
      document.getElementById('js-default-link').classList.add('hidden');

  }
    else 
    document.getElementById('js-default-link').classList.remove('hidden');

}

const renderList = data => {
  const features = data.reduce((acc, cur) => {
    return cur.type === FEAT && cur.labels.includes('mvp') ? {...acc, [cur.key]: {...cur, donePoint: 0, totalPoint: 0, doneCnt: 0, totalCnt: 0}} : acc;    
  }, {})

  data.forEach(issue => {
    const feature = features[issue.parent];
    const point = issue.point || 0;
    if (issue.type !== FEAT && feature) {
      feature.totalCnt++;
      feature.totalPoint += point;
      if (issue.status === Status.DONE) {
        feature.doneCnt++;
        feature.donePoint += point;
        if (feature.status !== Status.DONE) {
          feature.status = Status.IN_PROGRESS;
        }          
      }
    }
  });

  const featList = Object.keys(features).map(key => {
    const issue = features[key];
    const updatedTotalPoint = issue.totalPoint < 30 ? PTS : issue.totalPoint;
    const progress = parseInt(issue.donePoint / updatedTotalPoint * 100, 10);
    const statusElem = `<div class='status' style='background: linear-gradient(to right, lightblue ${progress}%, transparent ${progress}%);'><span class='status-text'>${issue.status}</span></div>`;
    
    return ({...features[key], updatedTotalPoint, progress, statusElem })
  });

  featList.sort((a, b) => a.progress <= b.progress ? 1: -1);

  const listElem = document.getElementById('js-ul');
  listElem.innerHTML = 
    `<li class='li_main'>
      <div class='w2 col-mid title'>Epic</div>
      <div class='w3 title'>Title</div>
      <div class='w1 col-end title'>Completed</div>
      <div class='w1 title'>Total Pts</div>
      <div class='w1 col-end title'>%</div>
      <div class='w2 col-mid title'>Status</div>
    </li>`;
    
  featList.forEach(epic => {
    const { key, title, donePoint, totalPoint, updatedTotalPoint, progress, statusElem} = epic;

    const totalPts = totalPoint !== updatedTotalPoint ? `<span class='red'><s>${totalPoint}</s> (${updatedTotalPoint})</span>`: totalPoint;
    listElem.innerHTML += 
      `<li class='li_main'>
        <div class='w2 col-mid'><a target='_blank' href='https://phillydev.atlassian.net/browse/${key}'>${key}</a></div>
        <div class='w3'>${title}</div>
        <div class='w1 col-end'>${donePoint}</div>
        <div class='w1 col-end'>${totalPts}</div>
        <div class='w1 col-end'>${progress}%</div>
        <div class='w2 col-mid'>${statusElem}</div>
      </li>`;

  });

  renderSummary(featList);

{/* <img src='./img/circle-check.svg' alt='checked'> */}
}

const fetchData = async () => {
  let data = [];
  let seq = 1;
  while(true) {
    try {
      const raw = await readFile(seq++);
      data = [...data, ...parseData(raw)];
    } catch(e) { break; }
  }

  renderList(data);
}

const main = async () => {
  checkLocalStorage();
  fetchData();
}

main();