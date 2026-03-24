# Email Signup Form Design

Replace Discord CTAs with Mailerlite email signup forms.

## Overview

Both the Hero and EarlyAccess sections currently link to Discord. These will be replaced with inline email signup forms that collect first name + email and submit to Mailerlite.

## Component Structure

Create a single reusable `EmailSignupForm.astro` component used in both locations.

**Props:**
- `heading` (optional) - context-specific titles
- `buttonText` - e.g., "Join Early Access"
- `showBenefits` (boolean) - EarlyAccess shows benefits list, Hero doesn't

**Form contains:**
- First name input (text field)
- Email input (email field)
- Submit button
- Success state (hidden by default)
- Error state (hidden by default)

## Mailerlite Integration

**Setup:**
- Include Mailerlite's Universal JavaScript snippet in page `<head>`
- Required: Mailerlite account ID and group ID

**Submission flow:**
1. User fills in name + email, clicks submit
2. JavaScript prevents default form submission
3. Client-side validation (required fields, email format)
4. Show loading state on button
5. Call Mailerlite's JS API to create subscriber
6. On success: hide form, show success message
7. On error: show inline error message, keep form visible for retry

**Configuration:**
- Store account ID and group ID as environment variables or config

## Visual Design

**Form layout:**
- Fields stack vertically on mobile, inline on larger screens
- First name placeholder: "First name"
- Email placeholder: "Email address"
- Submit button uses existing `btn-primary` styling

**Hero section:**
- Replace `<a>` button with signup form
- Keep same spacing and centering

**EarlyAccess section:**
- Replace Discord button with signup form
- Keep benefits list above form
- Update copy from "Join our Discord to:" to "Sign up for early access to:"
- Replace Discord icon with arrow or mail icon

**Success state:**
- Replaces entire form area
- Checkmark icon + "You're in! Check your inbox."
- Subtle fade-in animation

**Error state:**
- Red text below form: "Something went wrong. Please try again."
- Form remains editable

## Files

**Create:**
- `src/components/EmailSignupForm.astro`

**Modify:**
- `src/components/Hero.astro` - use EmailSignupForm, remove Discord link
- `src/components/EarlyAccess.astro` - use EmailSignupForm, update copy

## Configuration Required

Before implementation, obtain from Mailerlite dashboard:
- Account ID (Integrations section)
- Group/audience ID (the list for subscribers)
