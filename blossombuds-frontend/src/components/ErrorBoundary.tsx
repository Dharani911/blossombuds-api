import React from "react";
export class ErrorBoundary extends React.Component<{children:React.ReactNode},{hasError:boolean}> {
  state = { hasError:false };
  static getDerivedStateFromError(){ return { hasError:true }; }
  componentDidCatch(err:any){ console.error(err); }
  render(){ return this.state.hasError ? <div style={{padding:16}}>Something went wrong. Please try again.</div> : this.props.children; }
}
