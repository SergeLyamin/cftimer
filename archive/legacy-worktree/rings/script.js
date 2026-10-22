const circleNames = ["activity", "exercise", "stand"];
const circles = {};
const controllers = document.querySelectorAll(".controller");


function setProgress(circle) {
  const percent = circle.value / circle.limit * 100;
  
  if(percent <= 100) {
    const offset = circle.length - percent / 100 * circle.length;  
    circle.circle.style.strokeDashoffset = offset;
  } else {
    circle.circle.style.strokeDashoffset = 0;
  }
  
  circle.dot.style.transform = `rotate(${percent * 3.6}deg)`;
}

circleNames.forEach(circleName => {
  const circle = document.querySelector(`#${circleName} .progress-ring__circle`);
  const dot = document.querySelector(`#${circleName} .dot`);
  const length = circle.getTotalLength();
  let limit = 0;
  let value = 0;
  
  if(circleName === "activity") { limit = 880; value = 400; };
  if(circleName === "exercise") { limit = 30; value = 24; };
  if(circleName === "stand") { limit = 12; value = 10; };
  
  circles[circleName] = {
    circle,
    dot,
    length,
    limit,
    value
  }
  
  circle.style.strokeDashoffset = length;
  circle.style.strokeDasharray = `${length} ${length}`;
  
  document.querySelector(`#${circleName}Value`).textContent = circles[circleName].value;
  
  setProgress(circles[circleName]);
})

controllers.forEach(controller => {
  
  const target = controller.dataset.target;
  const iRI = document.querySelector(`.number-input[data-target="${target}"] .increase`);
  const iRV = document.querySelector(`.number-input[data-target="${target}"] .value`);
  const iRD = document.querySelector(`.number-input[data-target="${target}"] .decrease`);
  const incrementer = target === "activity" ? 50 : 1;
  
  iRI.addEventListener("click", e => {
    const newValue = Math.abs(parseInt(iRV.textContent) + incrementer);
    iRV.textContent = newValue;
    controller.value = newValue;
    controller.dispatchEvent(new Event('change'));
  })
  
  iRD.addEventListener("click", e => {
    const newValue = Math.abs(parseInt(iRV.textContent) - incrementer);
    iRV.textContent = newValue;
    controller.value = newValue;
    controller.dispatchEvent(new Event('change'));
  })
  
  controller.addEventListener("change", e => {
    const value = e.target.value;
    const target = e.target.dataset.target;
    
    circles[target].value = value;
    setProgress(circles[target]);
    document.querySelector(`#${target}Value`).textContent = circles[target].value;
  })
  
})