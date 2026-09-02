/* ==========================================================================
   KM.dev Academy — lesson content renderer
   Every block type in the content system, the drawn diagrams, the
   interactive demos, the prompt component, the video player and the
   lightbox. Nothing here is decorative: if it renders, it works.
   ========================================================================== */

window.KMBlocks = (function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* Minimal inline formatting: bold, code, links, line breaks. Anything the
     author did not write is escaped, so a lesson can never inject markup. */
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
      .replace(/\n/g, '<br>');
  }

  /* JSON parked inside a <script> tag must not be able to close it. A code
     sample containing a closing script tag would otherwise end the block and
     break the page — exactly the kind of bug this course teaches you to find. */
  function jsonScript(v) {
    return JSON.stringify(v).replace(/</g, '\\u003c');
  }

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  function hl(code, lang) {
    return (window.KM && KM.hl) ? KM.hl(code, lang) : esc(code);
  }

  /* ====================================================== drawn diagrams */

  var DIAGRAMS = {
    shift: function () {
      var rows = [
        ['Remembering syntax', 68, 12],
        ['Typing the first draft', 74, 14],
        ['Deciding what to build', 22, 62],
        ['Reading and judging output', 18, 70],
        ['Debugging', 46, 44]
      ];
      return '<div class="dg"><div class="dg__bars">' +
        rows.map(function (r) {
          return '<div class="dg__bar"><span>' + esc(r[0]) + '</span>' +
                 '<span><i style="width:' + r[1] + '%"></i>' +
                 '<i class="is-accent" style="width:' + r[2] + '%;margin-top:4px"></i></span></div>';
        }).join('') +
        '</div><div class="dg__row"><span class="dg__label">■ before &nbsp;&nbsp; ■ with AI assistance</span></div></div>';
    },

    request: function () {
      var steps = [
        ['01', 'You type an address'],
        ['02', 'Browser sends a request'],
        ['03', 'Server answers with index.html'],
        ['04', 'Browser asks for css and js'],
        ['05', 'Browser paints the page']
      ];
      return '<div class="dg"><div class="dg__steps">' +
        steps.map(function (s, i) {
          return '<div class="dg__step' + (i === 4 ? ' is-on' : '') + '">' +
                 '<em>' + s[0] + '</em><span>' + esc(s[1]) + '</span></div>';
        }).join('') + '</div></div>';
    },

    layers: function () {
      return '<div class="dg"><div class="dg__row">' +
        '<div class="dg__node"><b>HTML</b>structure and meaning<br>what things are</div>' +
        '<span class="dg__arrow">→</span>' +
        '<div class="dg__node"><b>CSS</b>appearance<br>how they look</div>' +
        '<span class="dg__arrow">→</span>' +
        '<div class="dg__node is-accent"><b>JavaScript</b>behaviour<br>what they do</div>' +
        '</div><div class="dg__row"><span class="dg__label">' +
        'change one without breaking the other two</span></div></div>';
    },

    split: function () {
      return '<div class="dg"><div class="dg__split">' +
        '<div class="dg__col"><span class="dg__label">their computer</span>' +
        '<div class="dg__node"><b>Front end</b>layout · type · interaction<br>readable · editable · not trusted</div></div>' +
        '<span class="dg__rule"></span>' +
        '<div class="dg__col"><span class="dg__label">your computer</span>' +
        '<div class="dg__node is-ink"><b>Back end</b>accounts · permissions · data<br>the only place a rule is real</div></div>' +
        '</div></div>';
    },

    context: function () {
      return '<div class="dg"><div class="dg__row">' +
        '<div class="dg__node is-accent"><b>In the conversation</b>your messages · pasted code · its own replies</div>' +
        '<div class="dg__node"><b>Not available</b>your files · yesterday · your screen · your client</div>' +
        '</div><div class="dg__row"><span class="dg__label">' +
        'if it is not on the left, it does not exist</span></div></div>';
    },

    workflow: function () {
      var steps = ['Goal', 'Context', 'Constraints', 'Direction', 'Technical', 'Implement',
                   'Inspect', 'Test', 'Report', 'Iterate', 'Refactor', 'Polish', 'Ship'];
      return '<div class="dg"><div class="dg__steps">' +
        steps.map(function (s, i) {
          return '<div class="dg__step' + (i < 5 ? ' is-on' : '') + '">' +
                 '<em>' + ('0' + (i + 1)).slice(-2) + '</em><span>' + esc(s) + '</span></div>';
        }).join('') +
        '</div><div class="dg__row"><span class="dg__label">' +
        'the highlighted five happen before any code exists</span></div></div>';
    },

    anatomy: function () {
      var parts = [
        ['Goal', 'what it must do'],
        ['Context', 'who and what for'],
        ['Constraints', 'what is ruled out'],
        ['Direction', 'decisions already made'],
        ['Scope', 'how much you want back'],
        ['Output', 'files, language, format']
      ];
      return '<div class="dg"><div class="dg__steps">' +
        parts.map(function (p, i) {
          return '<div class="dg__step' + (i === 2 ? ' is-on' : '') + '">' +
                 '<em>' + ('0' + (i + 1)).slice(-2) + '</em><span>' + esc(p[0]) + '</span>' +
                 '<em style="letter-spacing:.04em">' + esc(p[1]) + '</em></div>';
        }).join('') + '</div></div>';
    },

    narrowing: function () {
      var rows = [
        ['no constraints', 100],
        ['+ audience named', 62],
        ['+ technical rules', 38],
        ['+ visual direction', 20],
        ['+ exclusions', 9]
      ];
      return '<div class="dg"><div class="dg__bars">' +
        rows.map(function (r, i) {
          return '<div class="dg__bar"><span>' + esc(r[0]) + '</span>' +
                 '<i class="' + (i === rows.length - 1 ? 'is-accent' : '') + '" style="width:' + r[1] + '%"></i></div>';
        }).join('') +
        '</div><div class="dg__row"><span class="dg__label">' +
        'space of answers the model could reasonably give</span></div></div>';
    },

    axes: function () {
      var ax = [['Typography', 'families · scale · tracking'],
                ['Space', 'unit · rhythm · air'],
                ['Colour', 'count · roles · frequency'],
                ['Composition', 'grid · alignment · balance'],
                ['Motion', 'what moves · how far · how fast']];
      return '<div class="dg"><div class="dg__steps">' +
        ax.map(function (a, i) {
          return '<div class="dg__step' + (i === 0 ? ' is-on' : '') + '">' +
                 '<em>' + ('0' + (i + 1)).slice(-2) + '</em><span>' + esc(a[0]) + '</span>' +
                 '<em style="letter-spacing:.04em">' + esc(a[1]) + '</em></div>';
        }).join('') + '</div></div>';
    }
  };

  /* ====================================================== interactive demos */

  var DEMOS = {
    'context-compare': function (host) {
      var levels = [
        { k: 'None', prompt: 'Build me a hero section.',
          out: 'A centred headline, a grey subtitle and a blue button. Technically fine. Could belong to any company on earth.',
          score: 1 },
        { k: 'Some', prompt: 'Build a hero for a design studio. Make it modern and clean.',
          out: 'Larger type, more whitespace, still a card and still a gradient. Better looking, same absence of a point of view.',
          score: 2 },
        { k: 'Full', prompt: 'Build a hero for a two-person studio whose visitors are art directors comparing three shortlists. One action: view the work. Oversized headline set tight, one accent colour, asymmetric, no card, no gradient, readable at 360px.',
          out: 'An asymmetric composition with a headline that carries the message, one accent, and a single link. Something you would argue about rather than ignore.',
          score: 4 }
      ];
      var i = 0;
      host.innerHTML =
        '<div class="idemo__tabs">' + levels.map(function (l, n) {
          return '<button class="idemo__tab' + (n === 0 ? ' is-on' : '') + '" type="button" data-i="' + n + '">' +
                 esc(l.k) + ' context</button>';
        }).join('') + '</div>' +
        '<div class="idemo__out" data-prompt></div>' +
        '<div class="pw" data-score="1"><i></i><i></i><i></i><i></i></div>' +
        '<p class="idemo__note" data-out></p>';

      function paint() {
        $('[data-prompt]', host).textContent = levels[i].prompt;
        $('[data-out]', host).textContent = levels[i].out;
        $('.pw', host).setAttribute('data-score', String(levels[i].score));
        $$('.idemo__tab', host).forEach(function (b, n) { b.classList.toggle('is-on', n === i); });
      }
      $$('.idemo__tab', host).forEach(function (b) {
        b.addEventListener('click', function () { i = +b.dataset.i; paint(); });
      });
      paint();
    },

    'code-explainer': function (host) {
      var lines = [
        { t: '.card{', pick: false },
        { t: '  padding: 20px;', pick: true, prop: 'padding', vals: ['20px', '40px', '10px'],
          apply: function (n, v) { n.style.padding = v; },
          note: 'Space is a decision. One value changes how the whole thing breathes.' },
        { t: '  border-radius: 14px;', pick: true, prop: 'border-radius', vals: ['14px', '2px', '999px'],
          apply: function (n, v) { n.style.borderRadius = v; },
          note: 'Radius sets the tone: sharp reads technical, round reads friendly.' },
        { t: '  border: 1px solid #e4e2d9;', pick: false },
        { t: '}', pick: false }
      ];
      host.innerHTML =
        '<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,240px);gap:16px;align-items:start" data-grid>' +
          '<div class="blk-code"><div class="editor"><div class="editor__body" data-code></div></div></div>' +
          '<div style="border:1px solid var(--line);border-radius:var(--r-s);padding:16px;background:var(--bg)">' +
            '<div data-target style="background:var(--paper);border:1px solid #e4e2d9;border-radius:14px;padding:20px;' +
            'font-family:\'Space Grotesk\',sans-serif;font-size:15px;transition:all 420ms cubic-bezier(.2,.8,.2,1)">Card</div>' +
          '</div>' +
        '</div><p class="idemo__note" data-note>Click a line with a value to change it.</p>';

      var code = $('[data-code]', host), target = $('[data-target]', host);
      lines.forEach(function (l, i) {
        var row = el('<div class="code-line"><span class="code-line__n">' + (i + 1) +
                     '</span><span class="code-line__t">' + hl(l.t, 'css') + '</span></div>');
        if (l.pick) {
          row.classList.add('code-line--pick');
          row.setAttribute('tabindex', '0');
          row.setAttribute('role', 'button');
          var step = 0;
          var go = function () {
            step = (step + 1) % l.vals.length;
            var v = l.vals[step];
            l.apply(target, v);
            $('.code-line__t', row).innerHTML = hl('  ' + l.prop + ': ' + v + ';', 'css');
            $('[data-note]', host).textContent = l.note;
            $$('.code-line--pick', code).forEach(function (r) { r.classList.remove('is-sel'); });
            row.classList.add('is-sel');
          };
          row.addEventListener('click', go);
          row.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
          });
        }
        code.appendChild(row);
      });
      if (window.matchMedia('(max-width: 700px)').matches) {
        $('[data-grid]', host).style.gridTemplateColumns = '1fr';
      }
    },

    'trust-boundary': function (host) {
      var items = [
        { t: 'Deciding whether a password is correct', side: 'server' },
        { t: 'Animating a menu open', side: 'browser' },
        { t: 'Deciding who may delete a user', side: 'server' },
        { t: 'Showing a friendly error under a field', side: 'browser' },
        { t: 'Storing an order', side: 'server' },
        { t: 'Remembering which tab was open', side: 'browser' }
      ];
      var i = 0, right = 0;
      host.innerHTML =
        '<p class="idemo__note" data-q></p>' +
        '<div class="pillrow"><button class="btn btn--sm btn--ghost" type="button" data-side="browser">' +
        '<span class="btn__label">Their browser</span></button>' +
        '<button class="btn btn--sm btn--ghost" type="button" data-side="server">' +
        '<span class="btn__label">Your server</span></button></div>' +
        '<p class="idemo__note" data-fb style="min-height:22px"></p>';

      function paint() {
        if (i >= items.length) {
          $('[data-q]', host).innerHTML = '<strong>' + right + ' / ' + items.length + '</strong> — ' +
            (right === items.length
              ? 'Every one. The boundary is about trust, not difficulty.'
              : 'Anything that must be true regardless of what the browser claims belongs on the server.');
          $$('[data-side]', host).forEach(function (b) { b.style.display = 'none'; });
          return;
        }
        $('[data-q]', host).textContent = items[i].t;
        $('[data-fb]', host).textContent = '';
      }
      $$('[data-side]', host).forEach(function (b) {
        b.addEventListener('click', function () {
          if (i >= items.length) return;
          var ok = b.dataset.side === items[i].side;
          if (ok) right++;
          $('[data-fb]', host).textContent = ok ? 'Correct.'
            : 'It belongs on ' + (items[i].side === 'server' ? 'your server' : 'their browser') + '.';
          i++;
          setTimeout(paint, 700);
        });
      });
      paint();
    },

    session: function (host) {
      var turns = [
        ['you', 'I want to build a premium portfolio site for a two-person studio. Before any code, propose a structure and tell me why.'],
        ['ai', 'Five sections: a hero that states what you do, three project rows, a short about, and one contact block. The project rows carry the weight — for a studio, the work is the argument.'],
        ['you', 'Agreed. Build the hero only. Oversized headline, one accent, no card, no gradient. Readable at 360px.'],
        ['ai', 'Here is the hero. I set the headline in clamp() so it scales without a media query, and kept the supporting line to 14 words.'],
        ['you', 'At 380px the headline overlaps the nav.'],
        ['ai', 'The hero has a fixed 120px top padding but the nav is 76px and wraps to two lines below 420px. Changing the padding to a variable tied to the nav height fixes it at every width.'],
        ['you', 'Do that. Change nothing else.'],
        ['ai', 'Two lines changed. The nav height is now a custom property and the hero padding is calculated from it.']
      ];
      var n = 1;
      host.innerHTML = '<div class="chat" style="border:0"><div class="chat__body" data-log></div></div>' +
        '<div class="pillrow"><button class="btn btn--sm" type="button" data-step>' +
        '<span class="btn__label">Next message</span><i class="btn__arrow"></i></button>' +
        '<button class="btn btn--sm btn--ghost" type="button" data-reset><span class="btn__label">Restart</span></button></div>';

      function paint() {
        $('[data-log]', host).innerHTML = turns.slice(0, n).map(function (t) {
          return '<div class="msg is-in msg--' + (t[0] === 'you' ? 'me' : 'ai') + '">' + inline(t[1]) + '</div>';
        }).join('');
        $('[data-log]', host).scrollTop = 99999;
        $('[data-step]', host).disabled = n >= turns.length;
      }
      $('[data-step]', host).addEventListener('click', function () { n = Math.min(turns.length, n + 1); paint(); });
      $('[data-reset]', host).addEventListener('click', function () { n = 1; paint(); });
      paint();
    },

    versus: function (host) {
      var pairs = [
        ['Layout', 'Make the page layout better.',
         'Above 900px put the image and text side by side at 5:7 with 48px between. Keep the stacked order below.'],
        ['Bug', 'The menu is broken.',
         'Below 768px the menu opens on tap but will not close on a second tap. No console errors. Started after the scroll listener on line 40.'],
        ['Style', 'Make it feel premium.',
         'One accent used at most twice per screen, headline tracking -0.03em, no shadows, hairline borders, 96px between sections.'],
        ['Refactor', 'Clean up this code.',
         'The card markup repeats four times. Extract one function taking title, body and href. Do not change the rendered HTML or class names.'],
        ['Options', 'Give me some options.',
         'Three hero variations differing only in composition: centred, left with image right, full-bleed overlay. Same copy and tokens.'],
        ['Review', 'Is this good?',
         'Review for spacing against the 8px scale, type scale adherence, contrast and keyboard operability. Findings worst-first, no fixes yet.']
      ];
      var i = 0;
      host.innerHTML =
        '<div class="idemo__tabs">' + pairs.map(function (p, n) {
          return '<button class="idemo__tab' + (n === 0 ? ' is-on' : '') + '" type="button" data-i="' + n + '">' +
                 esc(p[0]) + '</button>';
        }).join('') + '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">' +
          '<div><span class="t-tag is-plain mono" style="color:#a03a28">Weak</span>' +
            '<div class="idemo__out" style="margin-top:8px" data-a></div></div>' +
          '<div><span class="t-tag is-plain mono" style="color:var(--accent-ink)">Strong</span>' +
            '<div class="idemo__out" style="margin-top:8px" data-b></div></div>' +
        '</div>';
      function paint() {
        $('[data-a]', host).textContent = pairs[i][1];
        $('[data-b]', host).textContent = pairs[i][2];
        $$('.idemo__tab', host).forEach(function (b, n) { b.classList.toggle('is-on', n === i); });
      }
      $$('.idemo__tab', host).forEach(function (b) {
        b.addEventListener('click', function () { i = +b.dataset.i; paint(); });
      });
      paint();
    },

    'instruction-gap': function (host) {
      var cases = [
        { s: 'Fix the header.', a: ['Only the header, or the navigation inside it too?',
                                    'Fix what, exactly — what is wrong with it?'], pick: 1 },
        { s: 'Make it responsive.', a: ['Down to what width, and on which device?',
                                        'Should it use a framework?'], pick: 0 },
        { s: 'Change the button colour to green.', a: ['Which green?',
                                                       'Should hover, focus and disabled change too?'], pick: 1 }
      ];
      var i = 0;
      host.innerHTML = '<div class="idemo__out" data-s></div>' +
        '<div class="pillrow" data-opts></div><p class="idemo__note" data-fb style="min-height:22px"></p>';
      function paint() {
        if (i >= cases.length) {
          $('[data-s]', host).textContent = 'Every instruction leaves something open. The habit is to find it before you send.';
          $('[data-opts]', host).innerHTML = '';
          $('[data-fb]', host).textContent = '';
          return;
        }
        $('[data-s]', host).textContent = '"' + cases[i].s + '"';
        $('[data-opts]', host).innerHTML = cases[i].a.map(function (a, n) {
          return '<button class="idemo__tab" type="button" data-n="' + n + '">' + esc(a) + '</button>';
        }).join('');
        $('[data-fb]', host).textContent = 'Which ambiguity costs you more?';
        $$('[data-n]', host).forEach(function (b) {
          b.addEventListener('click', function () {
            var ok = +b.dataset.n === cases[i].pick;
            $('[data-fb]', host).textContent = ok
              ? 'Yes — that is the one that quietly changes the result.'
              : 'That one matters, but the other is the expensive one.';
            i++;
            setTimeout(paint, 1100);
          });
        });
      }
      paint();
    },

    'prompt-builder': function (host) {
      var groups = [
        ['role', 'Role', [['a senior front-end developer', 'Front-end dev'], ['a design engineer', 'Design engineer']]],
        ['goal', 'Goal', [['build a landing page that books calls', 'Book calls'], ['build a portfolio that gets replies', 'Portfolio']]],
        ['project', 'Project', [['for a two-person architecture studio', 'Architecture studio'], ['for a solo photographer', 'Photographer']]],
        ['style', 'Style', [['in a restrained editorial style with oversized headlines', 'Editorial'], ['technical and monospace-led', 'Technical']]],
        ['layout', 'Layout', [['on a 12-column grid with asymmetric rows', '12-column'], ['as one centred column with wide margins', 'Single column']]],
        ['function', 'Function', [['with one call to action and a contact form', 'CTA + form'], ['with a filterable project list', 'Filterable']]],
        ['constraints', 'Constraints', [['No libraries, no stock imagery, readable from 360px.', 'No libs, no stock'], ['Semantic HTML, keyboard accessible, AA contrast.', 'Accessible']]],
        ['tech', 'Technology', [['Plain HTML, CSS and JavaScript in three files.', 'Three files'], ['One HTML file with inline CSS and JS.', 'Single file']]],
        ['output', 'Output', [['Return the code, then list three decisions I might disagree with.', 'Code + decisions'], ['Return a plan first, no code yet.', 'Plan first']]]
      ];
      var picked = {};
      host.innerHTML =
        '<div style="display:flex;flex-direction:column;gap:14px">' +
        groups.map(function (g) {
          return '<div><span class="dg__label">' + esc(g[1]) + '</span><div class="pillrow" style="margin-top:7px">' +
            g[2].map(function (o, n) {
              return '<button class="idemo__tab" type="button" data-g="' + g[0] + '" data-v="' + esc(o[0]) + '" data-n="' + n + '">' +
                     esc(o[1]) + '</button>';
            }).join('') + '</div></div>';
        }).join('') + '</div>' +
        '<div class="idemo__out" data-out></div>' +
        '<div class="pillrow"><button class="copy" type="button" data-copy>' +
        '<span class="copy__icon"></span><span>Copy prompt</span></button>' +
        '<span class="mono" data-count>0 / 9</span></div>';

      function build() {
        var order = ['role', 'goal', 'project', 'style', 'layout', 'function', 'tech', 'constraints', 'output'];
        var lead = picked.role ? 'Act as ' + picked.role + '. ' : '';
        var s = lead + (picked.goal ? 'Build ' + picked.goal.replace(/^build /, '') : 'Build a website');
        ['project', 'style', 'layout', 'function'].forEach(function (k) { if (picked[k]) s += ' ' + picked[k]; });
        s += '.';
        ['tech', 'constraints', 'output'].forEach(function (k) { if (picked[k]) s += '\n\n' + picked[k]; });
        return s;
      }
      function paint() {
        $('[data-out]', host).textContent = build();
        var n = Object.keys(picked).filter(function (k) { return picked[k]; }).length;
        $('[data-count]', host).textContent = n + ' / 9';
      }
      $$('[data-g]', host).forEach(function (b) {
        b.addEventListener('click', function () {
          var g = b.dataset.g, on = b.classList.contains('is-on');
          $$('[data-g="' + g + '"]', host).forEach(function (x) { x.classList.remove('is-on'); });
          if (on) { picked[g] = null; } else { b.classList.add('is-on'); picked[g] = b.dataset.v; }
          paint();
        });
      });
      $('[data-copy]', host).addEventListener('click', function () {
        copyText(build(), this);
      });
      paint();
    },

    'constraint-lab': function (host) {
      var cs = [
        ['Plain HTML, CSS and JS', 24],
        ['Readable from 360px', 14],
        ['No stock imagery', 18],
        ['One accent colour', 16],
        ['No cards or carousels', 19]
      ];
      var on = [];
      host.innerHTML = '<div class="pillrow">' + cs.map(function (c, i) {
        return '<button class="idemo__tab" type="button" data-i="' + i + '">' + esc(c[0]) + '</button>';
      }).join('') + '</div>' +
        '<div class="dg"><div class="dg__bar" style="grid-template-columns:150px minmax(0,1fr)">' +
        '<span>possible answers</span><i data-bar style="width:100%;transition:width 520ms cubic-bezier(.33,1,.68,1)"></i></div></div>' +
        '<p class="idemo__note" data-note>No constraints: the model returns the average of everything it has seen.</p>';
      function paint() {
        var w = 100;
        on.forEach(function (i) { w -= cs[i][1]; });
        w = Math.max(6, w);
        var bar = $('[data-bar]', host);
        bar.style.width = w + '%';
        bar.className = on.length >= 4 ? 'is-accent' : '';
        $('[data-note]', host).textContent = on.length === 0
          ? 'No constraints: the model returns the average of everything it has seen.'
          : on.length < 3
            ? 'Narrower. Still room for a result you would not ship.'
            : 'Now what remains is your work rather than everyone’s.';
      }
      $$('[data-i]', host).forEach(function (b) {
        b.addEventListener('click', function () {
          var i = +b.dataset.i, at = on.indexOf(i);
          if (at >= 0) { on.splice(at, 1); b.classList.remove('is-on'); }
          else { on.push(i); b.classList.add('is-on'); }
          paint();
        });
      });
      paint();
    },

    'direction-lab': function (host) {
      var state = { size: 34, space: 20, radius: 14, accent: 0 };
      host.innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px">' +
          '<label class="field"><span class="dg__label">Headline size</span>' +
            '<input type="range" min="20" max="64" value="34" data-k="size"></label>' +
          '<label class="field"><span class="dg__label">Space</span>' +
            '<input type="range" min="8" max="56" value="20" data-k="space"></label>' +
          '<label class="field"><span class="dg__label">Radius</span>' +
            '<input type="range" min="0" max="40" value="14" data-k="radius"></label>' +
          '<label class="field"><span class="dg__label">Accent</span>' +
            '<input type="range" min="0" max="2" value="0" data-k="accent"></label>' +
        '</div>' +
        '<div data-stage style="border:1px solid var(--line);background:var(--paper);overflow:hidden">' +
          '<div data-inner><div data-h style="font-family:\'Space Grotesk\',sans-serif;font-weight:500;letter-spacing:-0.035em;line-height:1">Studio Vanhorn</div>' +
          '<div style="height:6px;background:var(--line);border-radius:3px;margin-top:10px;width:70%"></div>' +
          '<div data-cta style="display:inline-block;margin-top:14px;padding:8px 16px;background:var(--ink);color:var(--bg);font-size:12px">See the work</div></div>' +
        '</div>' +
        '<p class="idemo__note">Four numbers. Same content. Move one at a time and watch what each is worth.</p>';

      function paint() {
        var st = $('[data-stage]', host), inner = $('[data-inner]', host);
        st.style.borderRadius = state.radius + 'px';
        inner.style.padding = state.space + 'px';
        $('[data-h]', host).style.fontSize = state.size + 'px';
        var cta = $('[data-cta]', host);
        cta.style.borderRadius = state.radius + 'px';
        cta.style.background = state.accent === 0 ? 'var(--ink)' : (state.accent === 1 ? 'var(--accent)' : '#3b82f6');
        cta.style.color = state.accent === 1 ? 'var(--accent-ink)' : 'var(--bg)';
      }
      $$('input[data-k]', host).forEach(function (r) {
        r.addEventListener('input', function () { state[r.dataset.k] = +r.value; paint(); });
      });
      paint();
    },

    'diff-review': function (host) {
      var before = ['.card{', '  padding: 24px;', '  border-radius: 14px;', '  display: grid;', '}'];
      var after = ['.card{', '  padding: 32px;', '  border-radius: 14px;', '  display: flex;', '}'];
      var revealed = false;
      host.innerHTML = '<div class="blk-code"><div class="editor"><div class="editor__body" data-code></div></div></div>' +
        '<div class="pillrow"><button class="btn btn--sm btn--ghost" type="button" data-show>' +
        '<span class="btn__label">Show every change</span></button></div>' +
        '<p class="idemo__note" data-note>You asked for the padding only. Read the diff before you accept it.</p>';
      function paint() {
        $('[data-code]', host).innerHTML = after.map(function (l, i) {
          var changed = l !== before[i];
          var cls = changed && revealed ? ' is-add' : '';
          return '<div class="code-line' + cls + '"><span class="code-line__n">' + (i + 1) +
                 '</span><span class="code-line__t">' + hl(l, 'css') + '</span></div>';
        }).join('');
        $('[data-note]', host).textContent = revealed
          ? 'Two lines changed, not one. The display switch was never requested — that is how a layout quietly moves.'
          : 'You asked for the padding only. Read the diff before you accept it.';
      }
      $('[data-show]', host).addEventListener('click', function () { revealed = true; paint(); });
      paint();
    }
  };

  /* ============================================================ copy button */

  function copyText(text, btn) {
    var done = function () {
      if (!btn) return;
      var label = $('span:last-child', btn);
      var was = label ? label.textContent : '';
      btn.classList.add('is-done');
      if (label) label.textContent = 'Copied';
      setTimeout(function () {
        btn.classList.remove('is-done');
        if (label) label.textContent = was;
      }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
    } else { fallback(text); done(); }
  }

  function fallback(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* ============================================================== lightbox */

  var lightbox = null, lbItems = [], lbIndex = 0, lbZoom = 1;

  function ensureLightbox() {
    if (lightbox) return lightbox;
    lightbox = el(
      '<div class="lightbox" role="dialog" aria-modal="true" aria-label="Image viewer">' +
        '<div class="lightbox__bar">' +
          '<span class="mono" data-count></span>' +
          '<span style="display:flex;gap:10px">' +
            '<button class="lb-btn" type="button" data-zoom="-" aria-label="Zoom out">&minus;</button>' +
            '<button class="lb-btn" type="button" data-zoom="+" aria-label="Zoom in">+</button>' +
            '<button class="lb-btn" type="button" data-close aria-label="Close">&times;</button>' +
          '</span>' +
        '</div>' +
        '<div class="lightbox__stage"><img alt=""></div>' +
        '<div class="lightbox__foot">' +
          '<button class="lb-btn" type="button" data-nav="-1" aria-label="Previous">&larr;</button>' +
          '<span data-cap></span>' +
          '<button class="lb-btn" type="button" data-nav="1" aria-label="Next">&rarr;</button>' +
        '</div>' +
      '</div>');
    document.body.appendChild(lightbox);

    $('[data-close]', lightbox).addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLightbox(); });
    $$('[data-nav]', lightbox).forEach(function (b) {
      b.addEventListener('click', function () { step(+b.dataset.nav); });
    });
    $$('[data-zoom]', lightbox).forEach(function (b) {
      b.addEventListener('click', function () {
        lbZoom = Math.min(3, Math.max(1, lbZoom + (b.dataset.zoom === '+' ? 0.35 : -0.35)));
        $('img', lightbox).style.setProperty('--z', lbZoom);
      });
    });
    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('is-on')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    });
    return lightbox;
  }

  function step(d) {
    if (!lbItems.length) return;
    lbIndex = (lbIndex + d + lbItems.length) % lbItems.length;
    paintLightbox();
  }

  function paintLightbox() {
    var it = lbItems[lbIndex];
    lbZoom = 1;
    var img = $('img', lightbox);
    img.src = it.src;
    img.alt = it.alt || '';
    img.style.setProperty('--z', 1);
    $('[data-cap]', lightbox).textContent = it.caption || '';
    $('[data-count]', lightbox).textContent = (lbIndex + 1) + ' / ' + lbItems.length;
  }

  function openLightbox(items, index) {
    ensureLightbox();
    lbItems = items; lbIndex = index;
    paintLightbox();
    lightbox.classList.add('is-on');
    document.body.classList.add('is-locked');
    $('[data-close]', lightbox).focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-on');
    document.body.classList.remove('is-locked');
  }

  /* ========================================================= video player */

  function mountVideo(node, block, ctx) {
    var stage = $('[data-stage]', node);
    var hasSrc = !!block.src;
    var video = null;

    if (hasSrc) {
      video = document.createElement('video');
      video.src = block.src;
      video.preload = 'metadata';
      video.playsInline = true;
      if (block.poster) video.poster = block.poster;
      stage.appendChild(video);
    }

    var play = $('[data-play]', node);
    var track = $('[data-track]', node);
    var time = $('[data-time]', node);
    var rate = $('[data-rate]', node);
    var rates = [1, 1.25, 1.5, 2], ri = 0;
    var marked = false;

    function fmt(s) {
      if (!isFinite(s)) return '0:00';
      var m = Math.floor(s / 60), r = Math.floor(s % 60);
      return m + ':' + ('0' + r).slice(-2);
    }

    if (!hasSrc) {
      play.disabled = true;
      return;
    }

    play.addEventListener('click', function () {
      if (video.paused) { video.play(); } else { video.pause(); }
    });
    video.addEventListener('play', function () { play.innerHTML = pauseIcon(); });
    video.addEventListener('pause', function () { play.innerHTML = playIcon(); });
    video.addEventListener('timeupdate', function () {
      var p = video.duration ? video.currentTime / video.duration : 0;
      track.style.setProperty('--p', p.toFixed(4));
      time.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
      if (!marked && p >= 0.9) {
        marked = true;
        node.classList.add('is-seen');
        if (ctx && ctx.onVideoSeen) ctx.onVideoSeen(p);
      } else if (ctx && ctx.onVideoProgress && Math.random() < 0.02) {
        ctx.onVideoProgress(p);
      }
    });
    track.addEventListener('click', function (e) {
      var r = track.getBoundingClientRect();
      video.currentTime = ((e.clientX - r.left) / r.width) * (video.duration || 0);
    });
    rate.addEventListener('click', function () {
      ri = (ri + 1) % rates.length;
      video.playbackRate = rates[ri];
      rate.textContent = rates[ri] + '×';
    });
  }

  function playIcon() { return '<svg width="11" height="12" viewBox="0 0 11 12" aria-hidden="true"><path d="M1 1l9 5-9 5z" fill="currentColor"/></svg>'; }
  function pauseIcon() { return '<svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><rect x="0" y="0" width="3" height="12" fill="currentColor"/><rect x="7" y="0" width="3" height="12" fill="currentColor"/></svg>'; }

  /* ============================================================== renderer */

  function renderBlock(b, ctx, images) {
    switch (b.t) {
      case 'h':
        return '<h2 class="blk-h">' + inline(b.text) + '</h2>';

      case 'p':
        return '<p class="blk-p">' + inline(b.text) + '</p>';

      case 'list':
        return '<ul class="blk-list">' + (b.items || []).map(function (it, i) {
          return '<li class="blk-li">' +
            (b.ordered ? '<em>' + ('0' + (i + 1)).slice(-2) + '</em>' : '<i></i>') +
            '<span>' + inline(it) + '</span></li>';
        }).join('') + '</ul>';

      case 'code':
        return '<div class="blk-code">' +
          '<div class="blk-code__bar"><span>' + esc(b.filename || b.lang || 'code') + '</span>' +
          '<button class="copy" type="button" data-copy-code style="padding:6px 12px;font-size:12px">' +
          '<span class="copy__icon"></span><span>Copy</span></button></div>' +
          '<div class="editor"><div class="editor__body">' +
          String(b.code).split('\n').map(function (line, i) {
            return '<div class="code-line"><span class="code-line__n">' + (i + 1) +
                   '</span><span class="code-line__t">' + hl(line, b.lang || 'js') + '</span></div>';
          }).join('') +
          '</div></div>' +
          '<script type="application/json" data-raw>' + jsonScript(b.code) + '<\/script></div>';

      case 'figure':
        return '<figure class="blk-figure"><div class="blk-figure__canvas">' +
          ((DIAGRAMS[b.kind] || function () { return ''; })()) +
          '</div><figcaption>' + esc(b.caption || '') + '</figcaption></figure>';

      case 'img': {
        if (!b.src) {
          return '<figure class="blk-img"><div class="blk-img__empty">' +
            '<span class="mono">Image slot</span>' +
            '<span class="t-small" style="max-width:38ch">' + esc(b.caption || b.alt || 'A screenshot belongs here.') +
            ' Add the file in the lesson editor and it appears in place of this panel.</span>' +
            '</div></figure>';
        }
        var idx = images.length;
        images.push({ src: b.src, alt: b.alt || '', caption: b.caption || '' });
        return '<figure class="blk-img"><button type="button" data-lb="' + idx + '">' +
          '<img src="' + esc(b.src) + '" alt="' + esc(b.alt || '') + '" loading="lazy"></button>' +
          (b.caption ? '<figcaption>' + esc(b.caption) + '</figcaption>' : '') + '</figure>';
      }

      case 'video':
        return '<div class="vid" data-video>' +
          '<div class="vid__stage" data-stage>' +
            (b.src ? '' :
              '<div class="vid__empty"><b>Lesson video</b>' +
              '<span class="t-small" style="max-width:40ch;color:var(--on-ink-dim)">' +
              'The player is wired up and tracks progress. Paste a video URL in the lesson editor ' +
              'and it plays here — nothing is invented in the meantime.</span></div>') +
            '<span class="chip is-ok vid__seen"><i></i><span>Video completed</span></span>' +
          '</div>' +
          '<div class="vid__bar">' +
            '<button class="vid__play" type="button" data-play aria-label="Play">' + playIcon() + '</button>' +
            '<span class="vid__time" data-time>0:00 / ' + esc(b.duration || '0:00') + '</span>' +
            '<span class="vid__track" data-track role="slider" tabindex="0" aria-label="Seek"><i></i></span>' +
            '<button class="vid__rate" type="button" data-rate>1×</button>' +
          '</div></div>';

      case 'prompt':
        return '<div class="prompt-c" data-prompt-c>' +
          '<div class="prompt-c__head"><span class="prompt-c__n">Prompt / ' + esc(b.n || '01') + '</span>' +
          '<span class="prompt-c__title">' + esc(b.title || '') + '</span></div>' +
          '<div class="prompt-c__body">' + esc(b.body).replace(/\{([A-Z0-9 _]+)\}/g,
            '<span class="ph">{$1}</span>') + '</div>' +
          '<div class="prompt-c__foot">' +
            '<button class="copy" type="button" data-copy-prompt>' +
            '<span class="copy__icon"></span><span>Copy prompt</span></button>' +
            '<span class="mono" style="color:var(--on-ink-dim)">paste into Claude and edit the placeholders</span>' +
          '</div>' +
          (b.why ? '<div class="why"><button class="why__btn" type="button" data-why>' +
            '<span>Why this works</span><span class="mono">open</span></button>' +
            '<div class="why__panel"><div class="why__inner"><div class="why__grid">' +
            ['context', 'constraints', 'output', 'iteration'].map(function (k) {
              return '<div class="why__cell"><b>' + k + '</b><p>' + esc(b.why[k] || '') + '</p></div>';
            }).join('') +
            '</div></div></div></div>' : '') +
          '<script type="application/json" data-raw>' + jsonScript(b.body) + '<\/script></div>';

      case 'callout':
        return '<div class="blk-callout is-' + esc(b.kind || 'note') + '">' +
          '<b>' + esc(b.title || b.kind || 'Note') + '</b>' +
          '<p>' + inline(b.text) + '</p></div>';

      case 'task':
        return '<div class="blk-task">' +
          '<div class="blk-task__head"><span class="t-tag">Build</span>' +
          '<h3 class="t-h4">' + esc(b.title || 'Try it') + '</h3></div>' +
          '<ol>' + (b.steps || []).map(function (s) { return '<li>' + inline(s) + '</li>'; }).join('') + '</ol>' +
          (b.done ? '<p class="blk-task__done">' + inline(b.done) + '</p>' : '') +
          '</div>';

      case 'quiz':
        return '<div class="blk-task" data-inline-quiz>' +
          '<div class="blk-task__head"><span class="t-tag">Test</span>' +
          '<h3 class="t-h4">' + esc(b.q) + '</h3></div>' +
          '<div class="aopts">' + (b.options || []).map(function (o, i) {
            return '<button class="aopt' + (b.type === 'multi' ? ' is-multi' : '') + '" type="button" data-i="' + i + '">' +
              '<span class="aopt__k">' + 'ABCDEF'[i] + '</span>' +
              '<span class="aopt__t">' + esc(o) + '</span>' +
              '<span class="aopt__mark"></span></button>';
          }).join('') + '</div>' +
          '<div class="assess__why"><p class="blk-p" data-why></p></div>' +
          '<script type="application/json" data-answer>' +
          jsonScript({ correct: b.correct || [], why: b.why || '' }) + '<\/script>' +
          '</div>';

      case 'demo':
        return '<div class="idemo" data-demo="' + esc(b.kind) + '">' +
          '<div class="idemo__head"><span class="mono">Try it</span>' +
          '<span class="t-small">' + esc(b.title || '') + '</span></div>' +
          '<div class="idemo__body" data-demo-body></div></div>';

      case 'summary':
        return '<div class="blk-summary"><span class="t-tag">In short</span>' +
          '<ul>' + (b.points || []).map(function (p) { return '<li>' + inline(p) + '</li>'; }).join('') + '</ul></div>';

      default:
        return '';
    }
  }

  function render(container, blocks, ctx) {
    ctx = ctx || {};
    var images = [];
    container.innerHTML = (blocks || []).map(function (b) {
      return '<div class="enter">' + renderBlock(b, ctx, images) + '</div>';
    }).join('');

    /* copy buttons -------------------------------------------------- */
    $$('[data-copy-code], [data-copy-prompt]', container).forEach(function (btn) {
      var host = btn.closest('.blk-code, .prompt-c');
      var raw = $('script[data-raw]', host);
      var text = raw ? JSON.parse(raw.textContent) : '';
      btn.addEventListener('click', function () { copyText(text, btn); });
    });

    /* why panels ---------------------------------------------------- */
    $$('[data-why]', container).forEach(function (btn) {
      if (btn.tagName !== 'BUTTON') return;
      btn.addEventListener('click', function () {
        var why = btn.closest('.why');
        var open = why.classList.toggle('is-open');
        $('.mono', btn).textContent = open ? 'close' : 'open';
      });
    });

    /* lightbox ------------------------------------------------------ */
    $$('[data-lb]', container).forEach(function (b) {
      b.addEventListener('click', function () { openLightbox(images, +b.dataset.lb); });
    });

    /* inline quizzes ------------------------------------------------ */
    $$('[data-inline-quiz]', container).forEach(function (q) {
      var data = JSON.parse($('script[data-answer]', q).textContent);
      var opts = $$('.aopt', q);
      opts.forEach(function (o) {
        o.addEventListener('click', function () {
          if (q.classList.contains('is-answered')) return;
          q.classList.add('is-answered');
          opts.forEach(function (x, i) {
            x.disabled = true;
            if (data.correct.indexOf(i) >= 0) x.classList.add('is-right');
            else if (x === o) x.classList.add('is-wrong');
          });
          $('[data-why]', q).textContent = data.why;
          $('.assess__why', q).classList.add('is-on');
        });
      });
    });

    /* video --------------------------------------------------------- */
    $$('[data-video]', container).forEach(function (node, i) {
      var block = (blocks || []).filter(function (b) { return b.t === 'video'; })[i] || {};
      mountVideo(node, block, ctx);
    });

    /* demos --------------------------------------------------------- */
    $$('[data-demo]', container).forEach(function (node) {
      var fn = DEMOS[node.dataset.demo];
      if (!fn) { node.remove(); return; }
      try { fn($('[data-demo-body]', node)); } catch (e) { node.remove(); }
    });

    /* staggered entrance -------------------------------------------- */
    var items = $$('.enter', container);
    if (window.KM && KM.reduced && KM.reduced()) {
      items.forEach(function (n) { n.classList.add('is-in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
      items.forEach(function (n, i) {
        n.style.setProperty('--ed', Math.min(i, 4) * 60 + 'ms');
        io.observe(n);
      });
    }

    return images;
  }

  return {
    render: render,
    inline: inline,
    esc: esc,
    copyText: copyText,
    openLightbox: openLightbox,
    diagrams: DIAGRAMS
  };
})();
