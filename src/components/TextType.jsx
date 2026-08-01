import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './TextType.css';

export default function TextType({
  text,
  as: Component = 'div',
  typingSpeed = 50,
  initialDelay = 0,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  className = '',
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorCharacter = '|',
  cursorClassName = '',
  cursorBlinkDuration = 0.5,
  textColors = [],
  variableSpeed,
  onSentenceComplete,
  startOnVisible = false,
  reverseMode = false,
  ...props
}) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(!startOnVisible);
  const cursorRef = useRef(null);
  const containerRef = useRef(null);

  const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);

  const getRandomSpeed = useCallback(() => {
    if (!variableSpeed) return typingSpeed;
    return Math.random() * (variableSpeed.max - variableSpeed.min) + variableSpeed.min;
  }, [typingSpeed, variableSpeed]);

  useEffect(() => {
    setDisplayedText('');
    setCurrentCharIndex(0);
    setIsDeleting(false);
    setCurrentTextIndex(0);
  }, [textArray]);

  useEffect(() => {
    if (!startOnVisible || !containerRef.current) return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setIsVisible(true);
    }, { threshold: 0.1 });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [startOnVisible]);

  useEffect(() => {
    if (!showCursor || !cursorRef.current) return undefined;
    if (navigator.userAgent.includes('jsdom')) return undefined;

    let disposed = false;
    let tween;

    import('gsap').then(({ gsap }) => {
      if (disposed || !cursorRef.current) return;
      gsap.set(cursorRef.current, { opacity: 1 });
      tween = gsap.to(cursorRef.current, {
        opacity: 0,
        duration: cursorBlinkDuration,
        repeat: -1,
        yoyo: true,
        ease: 'power2.inOut',
      });
    });

    return () => {
      disposed = true;
      tween?.kill();
    };
  }, [cursorBlinkDuration, showCursor]);

  useEffect(() => {
    if (!isVisible) return undefined;

    let timeout;
    const currentText = textArray[currentTextIndex] ?? '';
    const processedText = reverseMode ? [...currentText].reverse().join('') : currentText;

    const typeNextCharacter = () => {
      if (isDeleting) {
        if (displayedText === '') {
          setIsDeleting(false);
          if (currentTextIndex === textArray.length - 1 && !loop) return;
          onSentenceComplete?.(textArray[currentTextIndex], currentTextIndex);
          setCurrentTextIndex((previous) => (previous + 1) % textArray.length);
          setCurrentCharIndex(0);
        } else {
          timeout = setTimeout(() => {
            setDisplayedText((previous) => previous.slice(0, -1));
          }, deletingSpeed);
        }
      } else if (currentCharIndex < processedText.length) {
        timeout = setTimeout(() => {
          setDisplayedText((previous) => previous + processedText[currentCharIndex]);
          setCurrentCharIndex((previous) => previous + 1);
        }, variableSpeed ? getRandomSpeed() : typingSpeed);
      } else if (loop || currentTextIndex < textArray.length - 1) {
        timeout = setTimeout(() => setIsDeleting(true), pauseDuration);
      }
    };

    timeout = setTimeout(
      typeNextCharacter,
      currentCharIndex === 0 && !isDeleting && displayedText === '' ? initialDelay : 0,
    );

    return () => clearTimeout(timeout);
  }, [
    currentCharIndex,
    currentTextIndex,
    deletingSpeed,
    displayedText,
    getRandomSpeed,
    initialDelay,
    isDeleting,
    isVisible,
    loop,
    onSentenceComplete,
    pauseDuration,
    reverseMode,
    textArray,
    typingSpeed,
    variableSpeed,
  ]);

  const currentText = textArray[currentTextIndex] ?? '';
  const hideCursor = hideCursorWhileTyping && (currentCharIndex < currentText.length || isDeleting);
  const textColor = textColors.length === 0
    ? 'inherit'
    : textColors[currentTextIndex % textColors.length];

  return createElement(
    Component,
    {
      ref: containerRef,
      className: `text-type${className ? ` ${className}` : ''}`,
      ...props,
    },
    <span className="text-type__content" style={{ color: textColor }}>{displayedText}</span>,
    showCursor && (
      <span
        ref={cursorRef}
        className={`text-type__cursor${cursorClassName ? ` ${cursorClassName}` : ''}${hideCursor ? ' text-type__cursor--hidden' : ''}`}
        aria-hidden="true"
      >
        {cursorCharacter}
      </span>
    ),
  );
}
