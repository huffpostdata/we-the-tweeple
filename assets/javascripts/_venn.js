/**
 * Returns a <svg> string with a Venn diagram sized according to the input.
 *
 * Paramters:
 *   nPopulation: focus population (e.g., "we're looking at 200 people")
 *   nClinton: number of Clinton followers
 *   nTrump: number of Trump followers
 *   nBoth: number of Clinton followers who are also Trump followers
 */
module.exports = function(nPopulation, nClinton, nTrump, nBoth) {
  var rClinton = 50 * Math.sqrt(nClinton / nPopulation);
  var rTrump = 50 * Math.sqrt(nTrump / nPopulation);

  // Fail fast for botnet-y stuff
  if (rClinton === 0 && rTrump === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"></svg>';
  } else if (rClinton === 0) {
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">',
        '<circle class="trump" cx="100" cy="50" r="', rTrump, '"/>',
      '</svg>'
    ].join('');
  } else if (rTrump === 0) {
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">',
        '<circle class="clinton" cx="100" cy="50" r="', rClinton, '"/>',
      '</svg>'
    ].join('');
  }

  var aClinton = rClinton * rClinton * Math.PI;
  var aTrump = rTrump * rTrump * Math.PI;
  var aBoth = Math.min(aTrump, aClinton, Math.max(aClinton, aTrump) * nBoth / Math.max(nClinton, nTrump));

  if (aBoth === aClinton) {
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">',
        '<circle class="clinton" cx="100" cy="50" r="', rClinton, '"/>',
        '<circle class="trump" cx="100" cy="50" r="', rTrump, '"/>',
      '</svg>'
    ].join('');
  } else if (aBoth === aTrump) {
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">',
        '<circle class="trump" cx="100" cy="50" r="', rTrump, '"/>',
        '<circle class="clinton" cx="100" cy="50" r="', rClinton, '"/>',
      '</svg>'
    ].join('');
  }

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
  var xTrump = (d * d - rClinton * rClinton + rTrump * rTrump) / (2 * d);
  var xClinton = d - xTrump;
  var yArc = dToY(d);

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">',
      '<circle class="clinton" cx="', (100 - xClinton), '" cy="50" r="', rClinton, '"/>',
      '<circle class="trump" cx="', (100 + xTrump), '" cy="50" r="', rTrump, '"/>',
      '<path class="both" d="',
        'M100,', (50 + yArc),
        'A', rTrump, ',', rTrump, ' 0 ', (xTrump < 0 ? 1 : 0), ',1 100,', (50 - yArc),
        'A', rClinton, ',', rClinton, ' 0 ', (xClinton < 0 ? 1 : 0), ',1 100,', (50 + yArc),
        'Z"/>',
    '</svg>'
  ].join('');
}
