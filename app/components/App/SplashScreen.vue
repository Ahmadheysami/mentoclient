<template>
  <div
    class="fixed inset-0 z-[3060] bg-x-primary-content-200"
    role="status"
    aria-label="در حال آماده‌سازی منتویا"
  >
    <div class="relative mx-auto grid h-dvh w-full max-w-md place-items-center px-6">
      <!-- The prepared motion asset: centred and a little larger. -->
      <img
        src="/images/mentoya-motion.svg"
        alt="منتویا"
        width="1527"
        height="861"
        class="h-auto w-72 max-w-[82%]"
      />

      <!-- Loading indicator, pinned to the bottom edge. -->
      <div
        class="absolute inset-x-0 bottom-0 grid place-items-center pb-[max(1.75rem,env(safe-area-inset-bottom))]"
      >
        <div class="loader scale-125" aria-hidden="true"></div>
      </div>
    </div>
  </div>
</template>

<style lang="css">
.loader {
    position: relative;
    width: 2.5em;
    height: 2.5em;
    transform: rotate(165deg);
}

.loader:before,
.loader:after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    display: block;
    width: 0.5em;
    height: 0.5em;
    border-radius: 0.25em;
    transform: translate(-50%, -50%);
}

.loader:before {
    animation: before8 2s infinite;
}

.loader:after {
    animation: after6 2s infinite;
}

@keyframes before8 {
    0% {
        width: 0.5em;
        box-shadow: 1em -0.5em rgba(225, 20, 98, 0.75), -1em 0.5em rgba(111, 202, 220, 0.75);
    }

    35% {
        width: 2.5em;
        box-shadow: 0 -0.5em rgba(225, 20, 98, 0.75), 0 0.5em rgba(111, 202, 220, 0.75);
    }

    70% {
        width: 0.5em;
        box-shadow: -1em -0.5em rgba(225, 20, 98, 0.75), 1em 0.5em rgba(111, 202, 220, 0.75);
    }

    100% {
        box-shadow: 1em -0.5em rgba(225, 20, 98, 0.75), -1em 0.5em rgba(111, 202, 220, 0.75);
    }
}

@keyframes after6 {
    0% {
        height: 0.5em;
        box-shadow: 0.5em 1em rgba(61, 184, 143, 0.75), -0.5em -1em rgba(233, 169, 32, 0.75);
    }

    35% {
        height: 2.5em;
        box-shadow: 0.5em 0 rgba(61, 184, 143, 0.75), -0.5em 0 rgba(233, 169, 32, 0.75);
    }

    70% {
        height: 0.5em;
        box-shadow: 0.5em -1em rgba(61, 184, 143, 0.75), -0.5em 1em rgba(233, 169, 32, 0.75);
    }

    100% {
        box-shadow: 0.5em 1em rgba(61, 184, 143, 0.75), -0.5em -1em rgba(233, 169, 32, 0.75);
    }
}

@media (prefers-reduced-motion: reduce) {
    .loader:before,
    .loader:after {
        animation: none;
    }
}

html[data-motion="reduced"] .loader:before,
html[data-motion="reduced"] .loader:after {
    animation: none;
}
</style>
