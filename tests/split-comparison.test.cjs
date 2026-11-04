const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup({ pointers = true, left = 18, width = 354 } = {}) {
  const wrapperEvents = {}, windowEvents = {}, handleEvents = {};
  const classes = new Set(), captures = new Set(), properties = {}, attributes = {};
  const frames = [], timers = [];
  let onIntersection;
  const wrapper = {
    style: { setProperty: (key, value) => { properties[key] = value; } },
    classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
    getBoundingClientRect: () => ({ left, width }),
    addEventListener: (type, callback, options) => { wrapperEvents[type] = { callback, options }; },
    setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id),
    releasePointerCapture: id => captures.delete(id),
  };
  const handle = {
    setAttribute: (key, value) => { attributes[key] = value; },
    addEventListener: (type, callback) => { handleEvents[type] = callback; },
  };
  const context = vm.createContext({
    document: { getElementById: id => ({ sliderWrapper: wrapper, slideAfter: {}, sliderHandle: handle })[id] },
    window: { PointerEvent: pointers ? function () {} : undefined,
      addEventListener: (type, callback) => { windowEvents[type] = callback; } },
    IntersectionObserver: class {
      constructor(callback) { onIntersection = callback; }
      observe() {} disconnect() {}
    },
    requestAnimationFrame: callback => frames.push(callback),
    setTimeout: callback => timers.push(callback),
  });
  const source = fs.readFileSync('js/main.js','utf8');
  const start = source.indexOf('function initSplitComparisonSlider() {');
  const end = source.indexOf('function initMagneticCursorAndPulls()',start);
  vm.runInContext(source.slice(start,end),context);
  context.initSplitComparisonSlider();
  const event = values => ({ pointerId:1, pointerType:'touch', button:0, isPrimary:true,
    clientX:left+width/2, clientY:200, cancelable:true, prevented:false,
    preventDefault() { this.prevented = true; }, ...values });
  const emit = (type, values = {}) => {
    const e = event(values);
    wrapperEvents[type]?.callback(e);
    return e;
  };
  return { emit, wrapperEvents, attributes, classes, captures, frames, timers,
    position: () => parseFloat(properties['--split-pos']),
    key: key => handleEvents.keydown(event({ key })),
    hint: () => onIntersection([{ isIntersecting:true }]),
    runFrame: () => frames.shift()?.(), runTimer: () => timers.shift()?.(),
    mouse: (type, values) => windowEvents[type]?.(event(values)),
  };
}

test('phone horizontal drag follows the finger in both directions and clamps at the edges', () => {
  const s = setup();
  s.emit('pointerdown');
  assert.equal(s.position(),50);
  assert.equal(s.emit('pointermove',{ clientX:300, clientY:202 }).prevented,true);
  assert.ok(s.position()>75);
  s.emit('pointermove',{ clientX:80 });
  assert.ok(s.position()<20);
  s.emit('pointermove',{ clientX:-200 }); assert.equal(s.position(),4);
  s.emit('pointermove',{ clientX:900 }); assert.equal(s.position(),96);
  s.emit('pointerup',{ clientX:900 });
  assert.equal(s.classes.has('dragging'),false);
  assert.equal(s.captures.size,0);
  assert.equal(s.wrapperEvents.touchmove,undefined,'Modern browsers must not also run the touch fallback');
});
test('a vertical mobile swipe scrolls without jumping the comparison divider', () => {
  const s = setup();
  s.emit('pointerdown',{ clientX:300, clientY:200 });
  assert.equal(s.position(),50);
  const move=s.emit('pointermove',{ clientX:302, clientY:240 });
  assert.equal(move.prevented,false);
  assert.equal(s.position(),50);
  assert.equal(s.classes.has('dragging'),false);
  assert.equal(s.captures.size,0);
  s.emit('pointermove',{ clientX:350, clientY:250 });
  assert.equal(s.position(),50);
});
test('cancelled gestures clean up; secondary fingers cannot hijack the active drag', () => {
  const s = setup();
  s.emit('pointerdown');
  s.emit('pointermove',{ pointerId:2, clientX:350 }); assert.equal(s.position(),50);
  s.emit('pointerdown',{ pointerId:2, isPrimary:false, clientX:350 });
  s.emit('pointermove',{ clientX:300 });
  const dragged=s.position();
  s.emit('pointercancel');
  s.emit('pointermove',{ clientX:30 }); assert.equal(s.position(),dragged);
  s.emit('pointerdown',{ pointerId:3, clientX:200 });
  s.emit('pointermove',{ pointerId:3, clientX:70 }); assert.ok(s.position()<20);
  s.emit('lostpointercapture',{ pointerId:3 });
  assert.equal(s.classes.has('dragging'),false);
});
test('the auto hint never resets a position chosen by touch', () => {
  const s = setup();
  s.hint(); s.runTimer(); s.runFrame();
  s.emit('pointerdown'); s.emit('pointermove',{ clientX:300 });
  const chosen=s.position();
  s.runFrame();
  assert.equal(s.position(),chosen);
  const delayed = setup();
  delayed.hint(); delayed.emit('pointerdown',{ clientX:80 }); delayed.emit('pointerup',{ clientX:80 });
  const tapped=delayed.position();
  delayed.runTimer(); delayed.runFrame();
  assert.equal(delayed.position(),tapped);
});
test('desktop mouse drag and keyboard controls retain correct position and accessible values', () => {
  const s = setup({ left:100, width:800 });
  s.emit('pointerdown',{ pointerType:'mouse', clientX:300 }); assert.equal(s.position(),25);
  s.emit('pointermove',{ pointerType:'mouse', clientX:700 }); assert.equal(s.position(),75);
  s.emit('pointerup',{ pointerType:'mouse', clientX:700 });
  s.key('ArrowLeft'); assert.equal(s.position(),70);
  s.key('ArrowRight'); assert.equal(s.position(),75);
  s.key('Home'); assert.equal(s.position(),4);
  s.key('End'); assert.equal(s.position(),96);
  assert.equal(s.attributes['aria-valuenow'],'96');
});
test('legacy touch uses non-passive horizontal handling while permitting vertical scrolling', () => {
  const s=setup({ pointers:false });
  const touch=(x,y)=>({ identifier:7, clientX:x, clientY:y });
  s.emit('touchstart',{ touches:[touch(180,200)] });
  assert.equal(s.emit('touchmove',{ touches:[touch(300,202)] }).prevented,true);
  assert.ok(s.position()>75);
  assert.equal(s.wrapperEvents.touchmove.options.passive,false);
  s.emit('touchend',{ changedTouches:[touch(300,202)] });
  assert.equal(s.classes.has('dragging'),false);
  const position=s.position();
  s.emit('touchstart',{ touches:[touch(100,200)] });
  assert.equal(s.emit('touchmove',{ touches:[touch(101,240)] }).prevented,false);
  assert.equal(s.position(),position);
});
