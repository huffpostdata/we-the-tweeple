/**
 * Returns measurements along a number line.
 *
 * The returned measurements scale from -1 to 1. A radius of 1 means the number
 * of followers is equal to `nPopulation`; if it's at position -1, that means
 * all of those followers follow Clinton.
 *
 * In no order, all the assumptions you can make about the results:
 *
 * * When scaling, remember that a position of -1 and a radius of 1 will make
 *   the shape extend all the way to -2. In sum, the bounds of all shapes we
 *   can possibly return are (-2, -1) to (2, 1).
 * * It's impossible for both candidates to include the entire population and
 *   be disjoint sets. The maximum width of the X-axis for any _single_ return
 *   value is 2*sqrt(2). (That's when the disjoint sets each contain exactly
 *   half the population.)
 *
 * Parameters:
 *   nPopulation: focus population (e.g., "we're looking at 200 people")
 *   nClinton: number of Clinton followers
 *   nTrump: number of Trump followers
 *   nBoth: number of Clinton followers who are also Trump followers
 *
 * Return value:
 *
 *     {
 *       clinton: {
 *         r: (Number radius, [0, 1]),
 *         a: (Number πr², [0, π]),
 *         x: (Number position left of center, [-0.5, 1])
 *       },
 *       trump: {
 *         r: (Number radius, [0, 1]),
 *         a: (Number πr², [0, π]),
 *         x: (Number position of center, [-0.5, 1])
 *       },
 *       d: (Number clinton.x + trump.x, [0, 2]),
 *       a: (Number area of both, [0, π]),
 *       x: (Number center of arc, usually 0, [-?, ?]),
 *       y: (Number maximum y where clinton and trump circles intersect, [0, 1])
 *     }
 */
function measure(nPopulation, nClinton, nTrump, nBoth) {
  var rClinton = Math.sqrt(nClinton / nPopulation);
  var rTrump = Math.sqrt(nTrump / nPopulation);

  var aClinton = rClinton * rClinton * Math.PI;
  var aTrump = rTrump * rTrump * Math.PI;

  // Return if one area is empty
  if (nClinton === 0 && nTrump === 0) {
    return {
      clinton: { r: 0, a: 0, x: 0 },
      trump: { r: 0, a: 0, x: 0 },
      d: 0,
      a: 0,
      x: 0,
      y: 0
    };
  } else if (nClinton === 0) {
    return {
      clinton: { r: 0, a: 0, x: 0 },
      trump: { r: rTrump, a: aTrump, x: rTrump },
      d: rTrump,
      a: 0,
      x: 0,
      y: 0
    };
  } else if (nTrump === 0) {
    return {
      clinton: { r: rClinton, a: aClinton, x: rClinton },
      trump: { r: 0, a: 0, x: 0 },
      d: rClinton,
      a: 0,
      x: 0,
      y: 0
    };
  }

  var aBoth = Math.max(aClinton, aTrump) * nBoth / Math.max(nClinton, nTrump);
  aBoth = Math.min(aClinton, aTrump, aBoth); // in case of floating-point error?

  // Return if one area is included within the other.
  // To help with the legend, we'll pin the x of the smaller one at 0 and
  // move the x of the larger one.
  if (nBoth === nClinton || nBoth === nTrump) {
    if (nBoth === nClinton && nBoth === nTrump) {
      return {
        clinton: { r: rClinton, a: aClinton, x: 0 },
        trump: { r: rClinton, a: aClinton, x: 0 },
        d: 0,
        a: aClinton,
        x: 0,
        y: rClinton
      };
    } else if (nBoth === nClinton) { // nTrump is greater
      return {
        clinton: { r: rClinton, a: aClinton, x: 0 },
        trump: { r: rTrump, a: aTrump, x: (rTrump - rClinton) },
        d: (rTrump - rClinton),
        a: aClinton,
        x: 0,
        y: rClinton
      };
    } else { // nClinton is greater
      return {
        clinton: { r: rClinton, a: aClinton, x: (rClinton - rTrump) },
        trump: { r: rTrump, a: aTrump, x: 0 },
        d: (rClinton - rTrump),
        a: aTrump,
        x: 0,
        y: rTrump
      };
    }
    return {
      clinton: { r: rClinton, a: aClinton, x: (nBoth === nClinton ? 0 : rClinton) },
      trump: { r: rTrump, a: aTrump, x: (nBoth === nTrump ? 0 : rTrump) },
      d: 0,
      a: aBoth,
      x: (nBoth === nClinton ? rClinton : -rTrump),
      y: (nBoth === nClinton ? rClinton : rTrump)
    };
  }

  // Common case: a proper Venn diagram
  //
  // http://mathworld.wolfram.com/Circle-CircleIntersection.html
  function dToArea(d) {
    var p1 = rClinton * rClinton * Math.acos((d * d + rClinton * rClinton - rTrump * rTrump) / (2 * d * rClinton));
    var p2 = rTrump * rTrump * Math.acos((d * d + rTrump * rTrump - rClinton * rClinton) / (2 * d * rTrump));

    var inRoot = 1
      * (-d + rClinton + rTrump)
      * (+d + rClinton - rTrump)
      * (+d - rClinton + rTrump)
      * (+d + rClinton + rTrump);

    return p1 + p2 - 1 / 2 * Math.sqrt(inRoot);
  }

  function dToY(d) {
    var toRoot = 1
      * (-d + rClinton - rTrump)
      * (-d - rClinton + rTrump)
      * (-d + rClinton + rTrump)
      * (+d + rClinton + rTrump);
    return 1 / 2 / d * Math.sqrt(toRoot);
  }

  function solveForD(a) {
    var Tolerance2 = 0.000001;
    var MaxIter = 10000;

    var minD = 0;
    var maxD = rClinton + rTrump;

    for (var i = 0; i < MaxIter; i++) {
      var tryD = (minD + maxD) / 2;
      var err = dToArea(tryD) - a;
      if (err < Tolerance2 && err > -Tolerance2) return tryD;
      if (err < 0) {
        // area we found is smaller than what we want. Smaller d => larger area
        maxD = tryD;
      } else {
        // Our area is too big. Move circles apart. Smaller D => larger area
        minD = tryD;
      }
    }

    return (minD + maxD) / 2;
  }

  var d = solveForD(aBoth);
  var yArc = dToY(d);

  var xTrump = (d * d - rClinton * rClinton + rTrump * rTrump) / (2 * d);
  var xClinton = d - xTrump;
  var xArc = 0;

  if (xTrump < 0) {
    xClinton += xTrump;
    xArc = -xTrump;
    xTrump = 0;
  } else if (xClinton < 0) {
    xTrump += xClinton;
    xArc = xClinton;
    xClinton = 0;
  }

  return {
    clinton: { r: rClinton, a: aClinton, x: xClinton },
    trump: { r: rTrump, a: aTrump, x: xTrump },
    d: d,
    a: aBoth,
    x: xArc,
    y: yArc
  };
}

function renderIntersection(m, nPopulation, nClinton, nTrump, nBoth) {
  if (nBoth === 0) {
    return '';
  } else if (nBoth === nClinton) {
    return [
      '<circle class="both" cx="', m.x, '" cy="0" r="', m.clinton.r, '"/>'
    ].join('');
  } else if (nBoth === nTrump) {
    return [
      '<circle class="both" cx="', m.x, '" cy="0" r="', m.trump.r, '"/>'
    ].join('');
  } else {
    return [
      '<path class="both" d="',
        'M', m.x, ',', m.y,
        'A', m.trump.r, ',', m.trump.r, ' 0 ', (m.x > 0 ? 1 : 0), ',1 ', m.x, ',', -m.y,
        'A', m.clinton.r, ',', m.clinton.r, ' 0 ', (m.x < 0 ? 1 : 0), ',1 ', m.x, ',', m.y,
        'Z"/>'
    ].join('');
  }
}

/**
 * Returns a <svg> string with a Venn diagram sized according to the input.
 *
 * Parameters:
 *   nPopulation: focus population (e.g., "we're looking at 200 people")
 *   nClinton: number of Clinton followers
 *   nTrump: number of Trump followers
 *   nBoth: number of Clinton followers who are also Trump followers
 */
function renderVenn(nPopulation, nClinton, nTrump, nBoth) {
  var m = measure(nPopulation, nClinton, nTrump, nBoth);

  var both = renderIntersection(m, nPopulation, nClinton, nTrump, nBoth);

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -1 4 2">',
      '<circle class="clinton" cx="', -m.clinton.x, '" cy="0" r="', m.clinton.r, '"/>',
      '<circle class="trump" cx="', m.trump.x, '" cy="0" r="', m.trump.r, '"/>',
      both,
    '</svg>'
  ].join('');
}

module.exports = renderVenn;
