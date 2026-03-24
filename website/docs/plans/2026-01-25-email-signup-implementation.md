# Email Signup Form Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Discord CTAs with Mailerlite email signup forms in Hero and EarlyAccess sections.

**Architecture:** Create a reusable EmailSignupForm component with client-side JavaScript for Mailerlite integration. The form collects first name + email, submits via Mailerlite's Universal JS, and shows inline success/error states.

**Tech Stack:** Astro components, Tailwind CSS, Mailerlite Universal JavaScript

**Mailerlite Config:**
- Account ID: `1287538`
- Group ID: `177587700308640854`

---

### Task 1: Add Mailerlite Script to Layout

**Files:**
- Modify: `src/layouts/Layout.astro:22-23`

**Step 1: Add Mailerlite Universal JS to head**

In `src/layouts/Layout.astro`, add the Mailerlite script before the closing `</head>` tag:

```astro
    <title>{title}</title>
    <!-- Mailerlite Universal -->
    <script>
      (function(w,d,e,u,f,l,n){w[f]=w[f]||function(){(w[f].q=w[f].q||[])
      .push(arguments);},l=d.createElement(e),l.async=1,l.src=u,
      n=d.getElementsByTagName(e)[0],n.parentNode.insertBefore(l,n);})
      (window,document,'script','https://assets.mailerlite.com/js/universal.js','ml');
      ml('account', '1287538');
    </script>
  </head>
```

**Step 2: Verify script loads**

Run: `npm run dev`

Open browser devtools, check Network tab for `universal.js` loading. Check Console for no errors.

**Step 3: Commit**

```bash
git add src/layouts/Layout.astro
git commit -m "feat: add Mailerlite Universal script to layout"
```

---

### Task 2: Create EmailSignupForm Component

**Files:**
- Create: `src/components/EmailSignupForm.astro`

**Step 1: Create the component file**

Create `src/components/EmailSignupForm.astro` with this content:

```astro
---
interface Props {
  buttonText?: string;
  formId: string;
}

const { buttonText = 'Join Early Access', formId } = Astro.props;
const groupId = '177587700308640854';
---

<div class="email-signup-form" data-form-id={formId}>
  <!-- Form State -->
  <form class="signup-form flex flex-col sm:flex-row gap-3 justify-center" data-group-id={groupId}>
    <input
      type="text"
      name="name"
      placeholder="First name"
      required
      class="px-4 py-3 bg-bg-elevated border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent w-full sm:w-40"
    />
    <input
      type="email"
      name="email"
      placeholder="Email address"
      required
      class="px-4 py-3 bg-bg-elevated border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent w-full sm:w-64"
    />
    <button type="submit" class="btn-primary whitespace-nowrap">
      <span class="button-text">{buttonText}</span>
      <span class="button-loading hidden">
        <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </span>
      <svg class="w-4 h-4 button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
      </svg>
    </button>
  </form>

  <!-- Error State -->
  <p class="error-message hidden text-red-400 text-sm mt-3 text-center">
    Something went wrong. Please try again.
  </p>

  <!-- Success State -->
  <div class="success-message hidden text-center animate-fade-in">
    <div class="flex items-center justify-center gap-2 text-accent">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span class="text-lg font-medium text-text-primary">You're in!</span>
    </div>
    <p class="text-text-secondary mt-2">Check your inbox for confirmation.</p>
  </div>
</div>

<style>
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
</style>

<script>
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.email-signup-form').forEach((container) => {
      const form = container.querySelector('.signup-form') as HTMLFormElement;
      const errorMessage = container.querySelector('.error-message');
      const successMessage = container.querySelector('.success-message');
      const buttonText = container.querySelector('.button-text');
      const buttonLoading = container.querySelector('.button-loading');
      const buttonIcon = container.querySelector('.button-icon');
      const submitButton = form?.querySelector('button[type="submit"]');

      if (!form || !errorMessage || !successMessage || !buttonText || !buttonLoading || !buttonIcon || !submitButton) return;

      const groupId = form.dataset.groupId;

      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Reset states
        errorMessage.classList.add('hidden');
        buttonText.classList.add('hidden');
        buttonIcon.classList.add('hidden');
        buttonLoading.classList.remove('hidden');
        (submitButton as HTMLButtonElement).disabled = true;

        const formData = new FormData(form);
        const name = formData.get('name') as string;
        const email = formData.get('email') as string;

        try {
          // Use Mailerlite's ml function
          await new Promise<void>((resolve, reject) => {
            if (typeof (window as any).ml === 'function') {
              (window as any).ml('subscribe', {
                email: email,
                fields: {
                  name: name
                },
                groups: [groupId],
                success: () => resolve(),
                error: () => reject(new Error('Subscription failed'))
              });
              // Fallback timeout in case callback doesn't fire
              setTimeout(() => resolve(), 3000);
            } else {
              reject(new Error('Mailerlite not loaded'));
            }
          });

          // Show success
          form.classList.add('hidden');
          successMessage.classList.remove('hidden');
        } catch (error) {
          // Show error
          errorMessage.classList.remove('hidden');
          buttonText.classList.remove('hidden');
          buttonIcon.classList.remove('hidden');
          buttonLoading.classList.add('hidden');
          (submitButton as HTMLButtonElement).disabled = false;
        }
      });
    });
  });
</script>
```

**Step 2: Verify file created**

Run: `ls src/components/EmailSignupForm.astro`

Expected: File exists

**Step 3: Commit**

```bash
git add src/components/EmailSignupForm.astro
git commit -m "feat: create EmailSignupForm component with Mailerlite integration"
```

---

### Task 3: Update Hero Section

**Files:**
- Modify: `src/components/Hero.astro`

**Step 1: Replace Discord CTA with EmailSignupForm**

Replace entire content of `src/components/Hero.astro` with:

```astro
---
import EmailSignupForm from './EmailSignupForm.astro';
---

<section class="section-padding">
  <div class="container-content">
    <!-- Header -->
    <header class="flex items-center justify-center mb-16 md:mb-24">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
          <span class="text-black font-bold text-xl">B</span>
        </div>
        <span class="text-xl font-semibold">Basesignal</span>
      </div>
    </header>

    <!-- Hero Content -->
    <div class="text-center max-w-4xl mx-auto">
      <h1 class="heading-1 mb-6">
        100 events. Zero answers.
      </h1>
      <p class="body-text max-w-2xl mx-auto mb-4">
        Your tracking plan measures clicks, pageviews, and button taps.
        But can you answer: "Are users succeeding in our product?"
      </p>
      <p class="body-text max-w-2xl mx-auto mb-10 text-text-muted">
        Probably not. Because interactions don't measure outcomes.
      </p>

      <!-- Email Signup -->
      <EmailSignupForm formId="hero" buttonText="Join Early Access" />
    </div>
  </div>
</section>
```

**Step 2: Verify page renders**

Run: `npm run dev`

Visit http://localhost:4321 and verify Hero section shows the email form.

**Step 3: Commit**

```bash
git add src/components/Hero.astro
git commit -m "feat: replace Hero Discord CTA with email signup form"
```

---

### Task 4: Update EarlyAccess Section

**Files:**
- Modify: `src/components/EarlyAccess.astro`

**Step 1: Replace Discord CTA with EmailSignupForm**

Replace entire content of `src/components/EarlyAccess.astro` with:

```astro
---
import EmailSignupForm from './EmailSignupForm.astro';

const benefits = [
  'Get early access to the tool',
  'Shape the product roadmap',
  'Connect with other product analytics folks'
];
---

<section class="section-padding">
  <div class="container-content">
    <div class="max-w-2xl mx-auto text-center">
      <h2 class="heading-2 mb-6">
        Join the early access
      </h2>

      <p class="body-text mb-8">
        Basesignal is in early development. Sign up to:
      </p>

      <div class="flex flex-col items-center gap-3 mb-8">
        {benefits.map((benefit) => (
          <div class="flex items-center gap-3">
            <span class="text-accent">→</span>
            <span class="text-text-secondary">{benefit}</span>
          </div>
        ))}
      </div>

      <EmailSignupForm formId="early-access" buttonText="Get Early Access" />

      <p class="text-text-muted text-sm mt-4">
        Free. No credit card. Just early access.
      </p>
    </div>
  </div>
</section>
```

**Step 2: Verify page renders**

Run: `npm run dev`

Scroll to bottom of page and verify EarlyAccess section shows the email form.

**Step 3: Commit**

```bash
git add src/components/EarlyAccess.astro
git commit -m "feat: replace EarlyAccess Discord CTA with email signup form"
```

---

### Task 5: Manual Testing

**Files:** None (testing only)

**Step 1: Test form validation**

- Try submitting with empty fields - should show browser validation
- Try submitting with invalid email - should show browser validation

**Step 2: Test successful submission**

- Fill in valid name and email
- Click submit
- Should see loading spinner briefly
- Should see success message "You're in! Check your inbox."

**Step 3: Verify in Mailerlite**

- Log into Mailerlite dashboard
- Check Subscribers section
- Verify test email appears in the correct group

**Step 4: Test error state (optional)**

- Temporarily break the group ID
- Submit form
- Should see error message
- Restore correct group ID

**Step 5: Test both forms**

- Verify Hero form works
- Verify EarlyAccess form works
- Both should function independently

---

### Task 6: Final Commit

**Files:** None (just verification)

**Step 1: Check git status**

Run: `git status`

Expected: Clean working tree (all changes committed)

**Step 2: Review commits**

Run: `git log --oneline -5`

Verify all feature commits are present.
