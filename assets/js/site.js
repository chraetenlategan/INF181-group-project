/* ==========================================================================
   site.js — shared behaviour for every page of the resource.
   Small on purpose: mobile navigation, current-page marking, the footer year,
   and a switch that hides the team's drafting placeholders.
   ========================================================================== */
(function () {
  'use strict';

  /* ---- Mobile navigation ------------------------------------------------ */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('primary-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.getAttribute('data-open') === 'true';
      nav.setAttribute('data-open', open ? 'false' : 'true');
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.setAttribute('data-open', 'false');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.getAttribute('data-open') === 'true') {
        nav.setAttribute('data-open', 'false');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* ---- Mark the current page in the navigation -------------------------- */
  var here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__link').forEach(function (a) {
    var target = a.getAttribute('href').split('/').pop().split('#')[0];
    if (target === here) a.setAttribute('aria-current', 'page');
  });

  /* ---- Footer year ------------------------------------------------------ */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---- Drafting placeholders -------------------------------------------- */
  /* The .todo blocks mark where the team's written content goes. Pressing
     Ctrl+Shift+D hides them, so the site can be previewed as the client will
     see it before the content is finished. The preference sticks. All .todo
     blocks must be gone from the files before submission. */
  function applyTodoState() {
    var hidden = localStorage.getItem('lhh.hideTodo') === 'true';
    document.body.classList.toggle('hide-todo', hidden);
    var count = document.querySelectorAll('.todo').length;
    var badge = document.getElementById('todo-count');
    if (badge) {
      badge.textContent = count ? count + ' section' + (count === 1 ? '' : 's') + ' awaiting written content' : 'All sections written';
      badge.className = 'badge ' + (count ? 'badge--warn' : 'badge--ok');
    }
  }
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      localStorage.setItem('lhh.hideTodo', localStorage.getItem('lhh.hideTodo') === 'true' ? 'false' : 'true');
      applyTodoState();
    }
  });
  applyTodoState();

  /* ---- Build the on-page contents list from the h2s --------------------- */
  var toc = document.querySelector('[data-toc]');
  if (toc) {
    var list = document.createElement('ol');
    document.querySelectorAll('main h2[id]').forEach(function (h) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      li.appendChild(a);
      list.appendChild(li);
    });
    if (list.children.length) toc.appendChild(list);
    else toc.remove();
  }
}());
